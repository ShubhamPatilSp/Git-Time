import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import connectToDatabase from "@/lib/db"
import Job from "@/models/Job"
import User from "@/models/User"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Auth required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })
    }

    await connectToDatabase()
    
    // Ensure the user actually owns this job (job.userId === session.user.email typically)
    const job = await Job.findOne({ jobId, userId: session.user.email })
    
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Fetch latest credit balance when job is completed
    let runsThisMonth = 0
    let maxRuns = 3
    let isPro = false
    let freeCommitsUsed = 0
    if (job.status === 'completed') {
      const dbUser = await User.findOne({ email: session.user.email }).lean() as any
      if (dbUser) {
        isPro = dbUser.plan === 'pro' && dbUser.subscriptionExpiry && new Date() < new Date(dbUser.subscriptionExpiry)
        runsThisMonth = dbUser.runsThisMonth || 0
        maxRuns = typeof dbUser.getMonthlyRunLimit === 'function' ? dbUser.getMonthlyRunLimit() : (isPro ? 10 : 2)
        freeCommitsUsed = dbUser.freeCommitsUsed || 0
      }
    }

    return NextResponse.json({
      status: job.status,
      progress: job.progress,
      message: job.message,
      error: job.error,
      downloadUrl: job.downloadUrl,
      runsThisMonth,
      maxRuns,
      isPro,
      freeCommitsUsed,
      result: job.status === 'completed' ? {
        totalCommits: job.totalCommits,
        totalDays: job.totalDays,
        startDate: job.startDate,
        endDate: job.endDate,
        commits: job.commits,
        downloadUrl: job.downloadUrl,
      } : null
    })
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json({ error: 'Failed to retrieve status' }, { status: 500 })
  }
}
