import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { tmpdir } from 'os'
import fsExtra from 'fs-extra'
import AdmZip from 'adm-zip'
import { generateCommits, Author } from '@/lib/generator'
import { PatternName } from '@/lib/patterns'

export const runtime = 'nodejs'
export const maxDuration = 300

const TMP_DIR = join(tmpdir(), 'gittime-tmp')
const OUTPUT_DIR = join(tmpdir(), 'gittime-tmp', 'output')

async function addDirectoryToZip(zip: AdmZip, dirPath: string, zipPath: string): Promise<void> {
  const items = await fsExtra.readdir(dirPath, { withFileTypes: true })
  for (const item of items) {
    const fullPath = join(dirPath, item.name)
    const entryName = zipPath ? `${zipPath}/${item.name}` : item.name
    if (item.isDirectory()) {
      await addDirectoryToZip(zip, fullPath, entryName)
    } else {
      try {
        const content = await fsExtra.readFile(fullPath)
        zip.addFile(entryName, content)
      } catch { /* skip unreadable */ }
    }
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
      authorStyle = 'descriptive',
      addMergeCommits = false,
      excludeFolders = [],
      useAI = false,
      fileTypeDensity,
    } = body

    if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })
    if (!authors?.length) return NextResponse.json({ error: 'At least one author required' }, { status: 400 })

    const sessionDir = join(TMP_DIR, sessionId)
    const extractPath = join(sessionDir, 'extracted')

    if (!(await fsExtra.pathExists(extractPath))) {
      return NextResponse.json({ error: 'Session not found or expired. Please upload again.' }, { status: 404 })
    }

    await fsExtra.ensureDir(OUTPUT_DIR)

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

    const result = await generateCommits({
      extractPath,
      startDate: parsedStart,
      endDate: parsedEnd,
      authors: validatedAuthors,
      patternName: patternName as PatternName,
      totalCommits: totalCommits ? Number(totalCommits) : undefined,
      commitsPerDay: Number(commitsPerDay),
      branchName: branchName || 'main',
      weekdaysOnly: Boolean(weekdaysOnly),
      authorStyle: authorStyle || 'descriptive',
      addMergeCommits: Boolean(addMergeCommits),
      excludeFolders: Array.isArray(excludeFolders) ? excludeFolders : [],
      useAI: Boolean(useAI),
      fileTypeDensity: fileTypeDensity && typeof fileTypeDensity === 'object' ? fileTypeDensity : undefined,
    })

    // Package the repo
    const outputFileName = `gittime-${sessionId.slice(0, 8)}.zip`
    const outputPath = join(OUTPUT_DIR, outputFileName)

    const zip = new AdmZip()
    await addDirectoryToZip(zip, extractPath, '')
    zip.writeZip(outputPath)

    // Auto-cleanup after 15 minutes
    setTimeout(async () => {
      try {
        await fsExtra.remove(sessionDir)
        await fsExtra.remove(outputPath)
      } catch { /* ok */ }
    }, 15 * 60 * 1000)

    return NextResponse.json({
      downloadUrl: `/api/download/${outputFileName}`,
      totalCommits: result.totalCommits,
      totalDays: result.totalDays,
      startDate: result.startDate,
      endDate: result.endDate,
      commits: result.commits.slice(0, 100),
    })
  } catch (error: unknown) {
    console.error('Generate error:', error)
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
