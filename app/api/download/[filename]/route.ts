import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { tmpdir } from 'os'
import fsExtra from 'fs-extra'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export const runtime = 'nodejs'

const OUTPUT_DIR = join(tmpdir(), 'gittime-tmp', 'output')

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    // Require authentication to download
    const session = await getServerSession(authOptions)
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Auth required to download' }, { status: 401 })
    }

    const { filename } = params

    // Sanitize filename - only allow alphanumeric, hyphens, underscores, dots
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    if (!filename.endsWith('.zip')) {
      return NextResponse.json({ error: 'Not a zip file' }, { status: 400 })
    }

    const filePath = join(OUTPUT_DIR, filename)
    const exists = await fsExtra.pathExists(filePath)

    if (!exists) {
      return NextResponse.json(
        { error: 'File not found or already expired' },
        { status: 404 }
      )
    }

    const stat = await fsExtra.stat(filePath)
    
    // Stream the file instead of loading entire thing into memory
    const { createReadStream } = await import('fs')
    const nodeStream = createReadStream(filePath)
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk: any) => controller.enqueue(new Uint8Array(Buffer.from(chunk))))
        nodeStream.on('end', () => controller.close())
        nodeStream.on('error', (err) => controller.error(err))
      },
      cancel() { nodeStream.destroy() }
    })
    
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(stat.size),
      },
    })
  } catch (error: unknown) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Download failed' }, { status: 500 })
  }
}
