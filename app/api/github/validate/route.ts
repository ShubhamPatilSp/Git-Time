import { NextRequest, NextResponse } from 'next/server'
import { validateGitHubToken } from '@/lib/github'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

    const result = await validateGitHubToken(token)
    if (!result.valid) {
      return NextResponse.json({ error: 'Invalid GitHub token' }, { status: 401 })
    }

    return NextResponse.json({ username: result.username, email: result.email })
  } catch (err: unknown) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 })
  }
}
