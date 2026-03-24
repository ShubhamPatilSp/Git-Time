import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { v4 as uuidv4 } from 'uuid'
import AdmZip from 'adm-zip'
import fsExtra from 'fs-extra'
import { shouldSkipFile } from '@/lib/messages'

export const runtime = 'nodejs'
export const maxDuration = 60

const TMP_DIR = join(tmpdir(), 'gittime-tmp')

async function countFiles(dir: string): Promise<number> {
  let count = 0
  const items = await fsExtra.readdir(dir, { withFileTypes: true })
  for (const item of items) {
    const fullPath = join(dir, item.name)
    const rel = fullPath.replace(dir, '').replace(/^[/\\]/, '')
    if (shouldSkipFile(rel)) continue
    if (item.isDirectory()) {
      count += await countFiles(fullPath)
    } else {
      count++
    }
  }
  return count
}

export async function POST(request: NextRequest) {
  try {
    await fsExtra.ensureDir(TMP_DIR)

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!file.name.endsWith('.zip')) return NextResponse.json({ error: 'Only .zip files accepted' }, { status: 400 })
    if (file.size > 150 * 1024 * 1024) return NextResponse.json({ error: 'Max 150MB' }, { status: 400 })

    const sessionId = uuidv4()
    const sessionDir = join(TMP_DIR, sessionId)
    const zipPath = join(sessionDir, 'upload.zip')
    const extractPath = join(sessionDir, 'extracted')

    await fsExtra.ensureDir(sessionDir)
    await fsExtra.ensureDir(extractPath)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(zipPath, buffer)

    const zip = new AdmZip(zipPath)
    zip.extractAllTo(extractPath, true)
    await fsExtra.remove(zipPath)

    const fileCount = await countFiles(extractPath)

    return NextResponse.json({ sessionId, fileCount, message: 'Upload successful' })
  } catch (error: unknown) {
    console.error('Upload error:', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
