import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { tmpdir } from 'os'
import fsExtra from 'fs-extra'
import archiver from 'archiver'
import fs from 'fs'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import connectToDatabase from "@/lib/db"
import User from "@/models/User"
import Job from "@/models/Job"
import { generateCommits, Author } from '@/lib/generator'
import { PatternName } from '@/lib/patterns'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'
// Keep max duration high just in case, though the initial response is fast
export const maxDuration = 300

const TMP_DIR = join(tmpdir(), 'gittime-tmp')
const OUTPUT_DIR = join(tmpdir(), 'gittime-tmp', 'output')

// The async worker function that runs detached from the HTTP response
async function processGenerationJob(
  jobId: string,
  userEmail: string,
  sessionId: string,
  extractPath: string,
  options: any,
  isPro: boolean
) {
  try {
    await connectToDatabase()
    await Job.findOneAndUpdate({ jobId }, { status: 'processing', message: 'Initializing generation...', progress: 5 })

    const result = await generateCommits({
      ...options,
      onProgress: async (current: number, total: number, message: string) => {
        // Update job progress (reserve last 10% for zipping)
        const progress = 5 + Math.floor((current / total) * 85)
        await Job.findOneAndUpdate({ jobId }, { progress, message }).catch(() => {})
      }
    })

    await Job.findOneAndUpdate({ jobId }, { message: 'Zipping repository...', progress: 90 })

    await fsExtra.ensureDir(OUTPUT_DIR)
    const outputFileName = `gittime-${sessionId.slice(0, 8)}.zip`
    const outputPath = join(OUTPUT_DIR, outputFileName)

    // Stream generation to avoid in-memory limits
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(outputPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', () => resolve())
      archive.on('error', (err) => reject(err))

      archive.pipe(output)
      
      // We don't want to include the surrounding absolute path, just the contents
      archive.directory(extractPath, false)
      archive.finalize()
    })

    // Increment usage for ALL users (free and pro both have limits)
    const incQuery = isPro 
      ? { $inc: { runsThisMonth: 1 } }
      : { $inc: { runsThisMonth: 1, freeCommitsUsed: result.totalCommits } }
    
    await User.findOneAndUpdate(
      { email: userEmail },
      incQuery
    )

    await Job.findOneAndUpdate({ jobId }, { 
      status: 'completed', 
      progress: 100, 
      message: 'Complete!',
      downloadUrl: `/api/download/${outputFileName}`,
      totalCommits: result.totalCommits,
      totalDays: result.totalDays,
      startDate: result.startDate,
      endDate: result.endDate,
      commits: result.commits.slice(0, 100) // Keep the DB document size reasonable
    })

    // Auto-cleanup extract path after success
    // Increased to 10 minutes to avoid 404 on Push to GitHub
    setTimeout(async () => {
      try {
        await fsExtra.remove(extractPath)
      } catch { /* ok */ }
    }, 600000)

  } catch (error: any) {
    console.error('Job processing error:', error)
    await connectToDatabase()
    await Job.findOneAndUpdate({ jobId }, { 
      status: 'failed', 
      error: error?.message || 'Generation failed internally'
    })
    
    // Auto-cleanup on failure to prevent disk space leaks
    try {
      await fsExtra.remove(extractPath)
    } catch { /* ok */ }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sessionId,
      startDate,
      endDate,
      authors,
      patternName = 'daily-grind',
      totalCommits,
      commitsPerDay = 1,
      branchName = 'main',
      weekdaysOnly = false,
      timezone,
      toggledOffDates,
      authorStyle = 'descriptive',
      addMergeCommits = false,
      excludeFolders = [],
      useAI = false,
      injectPRMerges = false,
      fileTypeDensity,
    } = body

    // 1. Check Authentication & Plan
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Auth required to generate' }, { status: 401 })
    }

    await connectToDatabase()
    const dbUser = await User.findOne({ email: session.user.email })
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const activeJob = await Job.findOne({ 
      userId: session.user.email, 
      status: { $in: ['pending', 'processing'] } 
    })
    if (activeJob) {
      return NextResponse.json({ 
        error: 'You already have a repository generation in progress. Please wait for it to finish before starting a new one.' 
      }, { status: 429 })
    }

    const isPro = dbUser.plan === 'pro' && 
      dbUser.subscriptionExpiry && 
      new Date() < new Date(dbUser.subscriptionExpiry)

    // Reset monthly runs counter if needed
    const now = new Date()
    const resetAt = new Date(dbUser.runsResetAt || now)
    if (now > resetAt) {
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      dbUser.runsThisMonth = 0
      dbUser.runsResetAt = nextReset
      await dbUser.save()
    }

    const maxRuns = isPro ? 30 : 3
    const maxCommits = isPro ? 2000 : 100
    const requested = Number(totalCommits) || 0
    const used = dbUser.freeCommitsUsed || 0

    // 2. Enforce Plan Limits (applies to BOTH free and pro)
    if (dbUser.runsThisMonth >= maxRuns) {
      return NextResponse.json({ 
        error: `Monthly limit reached. You've used ${dbUser.runsThisMonth}/${maxRuns} generations this month.${isPro ? ' Your limit resets on the 1st.' : ' Upgrade to Pro for 30 generations/month!'}`,
        code: isPro ? 'LIMIT_REACHED' : 'PAYMENT_REQUIRED' 
      }, { status: 402 })
    }

    if (!isPro && used + requested > 100) {
      return NextResponse.json({ 
        error: `Lifetime limit reached. You have used ${used}/100 commit credits. Upgrade to Pro for unlimited commits!`,
        code: 'PAYMENT_REQUIRED' 
      }, { status: 402 })
    }

    if (requested > maxCommits) {
      return NextResponse.json({ 
        error: `Maximum ${maxCommits} commits per generation${isPro ? '' : '. Upgrade to Pro for 2,000 commits per generation!'}`,
        code: isPro ? 'LIMIT_REACHED' : 'PAYMENT_REQUIRED'
      }, { status: 402 })
    }

    if (!isPro) {
      if (useAI || injectPRMerges || (fileTypeDensity && Object.keys(fileTypeDensity).length > 0)) {
        return NextResponse.json({ error: 'Pro feature detected. Please upgrade to unlock.' }, { status: 403 })
      }
    }

    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    if (!authors?.length) return NextResponse.json({ error: 'At least one author required' }, { status: 400 })

    const sessionDir = join(TMP_DIR, sessionId)
    const extractPath = join(sessionDir, 'extracted')

    if (!(await fsExtra.pathExists(extractPath))) {
      return NextResponse.json({ error: 'Session not found or expired. Please upload again.' }, { status: 404 })
    }

    const parsedStart = new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000)
    const parsedEnd = new Date(endDate || Date.now())

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    const validatedAuthors: Author[] = authors.map((a: Author) => ({
      name: a.name?.trim() || 'Developer',
      email: a.email?.trim() || 'dev@example.com',
      weight: Number(a.weight) || 100,
    }))

    const jobId = uuidv4()

    await Job.create({
      jobId,
      userId: session.user.email,
      status: 'pending'
    })

    const options = {
      extractPath,
      startDate: parsedStart,
      endDate: parsedEnd,
      authors: validatedAuthors,
      patternName: patternName as PatternName,
      totalCommits: totalCommits ? Number(totalCommits) : undefined,
      commitsPerDay: Number(commitsPerDay),
      branchName: branchName || 'main',
      weekdaysOnly: Boolean(weekdaysOnly),
      timezone: timezone ? String(timezone) : undefined,
      toggledOffDates: Array.isArray(toggledOffDates) ? toggledOffDates : undefined,
      authorStyle: authorStyle || 'descriptive',
      addMergeCommits: Boolean(addMergeCommits),
      injectPRMerges: Boolean(injectPRMerges),
      excludeFolders: Array.isArray(excludeFolders) ? excludeFolders : [],
      useAI: Boolean(useAI),
      fileTypeDensity: fileTypeDensity && typeof fileTypeDensity === 'object' ? fileTypeDensity : undefined,
    }

    // Spawn async background task (fire and forget)
    // Note: On Vercel this might be suspended if deployed edge, but works reliably locally and on VPS
    processGenerationJob(jobId, session.user.email, sessionId, extractPath, options, isPro).catch(e => console.error("Unhandled worker error:", e))

    return NextResponse.json({ jobId })
  } catch (error: unknown) {
    console.error('API endpoint error:', error)
    const message = error instanceof Error ? error.message : 'Failed to queue generation'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
