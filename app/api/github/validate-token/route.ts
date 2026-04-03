import { NextRequest, NextResponse } from 'next/server'
import { validateGitHubToken } from '@/lib/github'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 })

    const result = await validateGitHubToken(token)
    if (!result.valid) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
