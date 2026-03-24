import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { tmpdir } from 'os'
import fsExtra from 'fs-extra'
import { pushToGitHub } from '@/lib/github'

export const runtime = 'nodejs'
export const maxDuration = 120

const TMP_DIR = join(tmpdir(), 'gittime-tmp')

export async function POST(request: NextRequest) {
  try {
    const { sessionId, token, repoName, isPrivate, branchName, description } = await request.json()

    if (!sessionId || !token || !repoName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const extractPath = join(TMP_DIR, sessionId, 'extracted')
    if (!(await fsExtra.pathExists(extractPath))) {
      return NextResponse.json({ error: 'Session expired. Please generate again.' }, { status: 404 })
    }

    const result = await pushToGitHub({
      token,
      repoName: repoName.replace(/[^a-zA-Z0-9._-]/g, '-'),
      repoPath: extractPath,
      isPrivate: Boolean(isPrivate),
      branchName: branchName || 'main',
      description,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('GitHub push error:', err)
    const message = err instanceof Error ? err.message : 'Push failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
