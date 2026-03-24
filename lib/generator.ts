import { join, relative } from 'path'
import fsExtra from 'fs-extra'
import { exec } from 'child_process'
import { promisify } from 'util'
import { generateMessage, sortFilesRealistically, shouldSkipFile } from './messages'
import { PATTERNS, generateDaySchedule, generateTimestamps, PatternName } from './patterns'
import { generateBatchedMessages } from './ai'

const execAsync = promisify(exec)

export interface Author {
  name: string
  email: string
  weight: number
}

export interface GenerateOptions {
  extractPath: string
  startDate: Date
  endDate: Date
  authors: Author[]
  patternName: PatternName
  totalCommits?: number
  commitsPerDay: number
  branchName: string
  weekdaysOnly: boolean
  authorStyle: 'terse' | 'descriptive' | 'conventional'
  addMergeCommits: boolean
  excludeFolders: string[]
  useAI?: boolean
  onProgress?: (current: number, total: number, message: string, file: string) => void
}

export interface CommitEntry {
  file: string
  date: string
  message: string
  author: string
  index: number
}

export interface GenerateResult {
  commits: CommitEntry[]
  totalCommits: number
  totalDays: number
  startDate: string
  endDate: string
}

async function gitExec(command: string, env?: Record<string, string>, cwd?: string): Promise<string> {
  try {
    const { stdout } = await execAsync(command, {
      cwd,
      env: { ...process.env, ...env },
      maxBuffer: 50 * 1024 * 1024,
    })
    return stdout.trim()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (
      msg.includes('nothing to commit') ||
      msg.includes('nothing added to commit') ||
      msg.includes('no changes added') ||
      msg.includes('already exists') ||
      msg.includes('did not match any file')
    ) {
      return ''
    }
    throw err
  }
}

export async function getAllFiles(dir: string, excludeFolders: string[] = []): Promise<string[]> {
  const files: string[] = []

  async function walk(current: string) {
    let items: fsExtra.Dirent[]
    try {
      items = await fsExtra.readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const item of items) {
      const fullPath = join(current, item.name)
      const relPath = relative(dir, fullPath).replace(/\\/g, '/')
      if (shouldSkipFile(relPath, excludeFolders)) continue
      if (item.isDirectory()) {
        await walk(fullPath)
      } else {
        files.push(fullPath)
      }
    }
  }

  await walk(dir)
  return files
}

function pickAuthor(authors: Author[], rng: () => number): Author {
  if (authors.length === 1) return authors[0]
  const total = authors.reduce((sum, a) => sum + a.weight, 0)
  let r = rng() * total
  for (const author of authors) {
    r -= author.weight
    if (r <= 0) return author
  }
  return authors[authors.length - 1]
}

function seededRng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

async function initGitRepo(repoPath: string, author: Author, branchName: string): Promise<void> {
  await gitExec('git init', {}, repoPath)
  await gitExec(`git config user.name "${author.name}"`, {}, repoPath)
  await gitExec(`git config user.email "${author.email}"`, {}, repoPath)
  const safeBranch = branchName.replace(/[^a-zA-Z0-9/_-]/g, '') || 'main'
  await gitExec(`git symbolic-ref HEAD refs/heads/${safeBranch}`, {}, repoPath)
}

async function stageAndCommit(
  repoPath: string,
  filePath: string,
  message: string,
  authorDate: Date,
  committerDate: Date,
  author: Author
): Promise<boolean> {
  const relPath = relative(repoPath, filePath).replace(/\\/g, '/')
  const safeMsg = message
    .replace(/\\/g, '')
    .replace(/"/g, "'")
    .replace(/`/g, '')
    .replace(/\$/g, '')
    .trim() || 'update file'

  await gitExec(`git add -- "${relPath}"`, {}, repoPath)

  const staged = await gitExec('git diff --cached --name-only', {}, repoPath)
  if (!staged || staged.trim() === '') return false

  const nameEsc = author.name.replace(/"/g, "'")
  const emailEsc = author.email.replace(/"/g, "'")

  await gitExec(
    `git -c user.name="${nameEsc}" -c user.email="${emailEsc}" commit -m "${safeMsg}"`,
    {
      GIT_AUTHOR_DATE: authorDate.toISOString(),
      GIT_COMMITTER_DATE: committerDate.toISOString(),
      GIT_AUTHOR_NAME: author.name,
      GIT_AUTHOR_EMAIL: author.email,
      GIT_COMMITTER_NAME: author.name,
      GIT_COMMITTER_EMAIL: author.email,
    },
    repoPath
  )
  return true
}

export async function generateCommits(options: GenerateOptions): Promise<GenerateResult> {
  const {
    extractPath,
    startDate,
    endDate,
    authors,
    patternName,
    totalCommits: requestedCommits,
    branchName,
    weekdaysOnly,
    authorStyle,
    addMergeCommits,
    excludeFolders,
    useAI,
    onProgress,
  } = options

  // Collect and sort files
  const rawFiles = await getAllFiles(extractPath, excludeFolders)
  if (rawFiles.length === 0) throw new Error('No files found in the uploaded project')

  const sortedRel = sortFilesRealistically(
    rawFiles.map(f => relative(extractPath, f).replace(/\\/g, '/'))
  )
  const allFiles = sortedRel.map(rel => join(extractPath, rel))
  const totalFiles = allFiles.length

  // How many commits to create — can be more or fewer than file count
  const desiredCommits = (requestedCommits && requestedCommits > 0)
    ? requestedCommits
    : totalFiles

  // Build day schedule
  const pattern = PATTERNS[patternName] || PATTERNS['daily-grind']
  const activePattern = weekdaysOnly ? { ...pattern, weekendProb: 0 } : pattern

  const daySchedule = generateDaySchedule(
    startDate,
    endDate,
    desiredCommits,
    activePattern,
    startDate.getTime()
  )

  if (daySchedule.length === 0) {
    throw new Error('No active days in selected date range. Try a wider range or different pattern.')
  }

  // Init repo
  const safeBranch = (branchName || 'main').replace(/[^a-zA-Z0-9/_-]/g, '')
  await initGitRepo(extractPath, authors[0], safeBranch)

  const commitEntries: CommitEntry[] = []
  const previousMessages: string[] = []
  const rng = seededRng(startDate.getTime())

  let commitsDone = 0
  let sinceLastMerge = 0

  // Main commit loop — iterate over scheduled days
  for (const daySlot of daySchedule) {
    if (commitsDone >= desiredCommits) break

    const commitsToday = Math.min(daySlot.commitCount, desiredCommits - commitsDone)
    if (commitsToday === 0) continue

    const timestamps = generateTimestamps(
      daySlot.date,
      commitsToday,
      activePattern,
      daySlot.date.getTime()
    )

    // Pre-calculate files for today for AI batching
    const filesToCommitToday = []
    let tempCommitsDone = commitsDone
    for (let c = 0; c < commitsToday && tempCommitsDone < desiredCommits; c++) {
      const currentFileIdx = tempCommitsDone % totalFiles
      const filePath = allFiles[currentFileIdx]
      const relPath = relative(extractPath, filePath).replace(/\\/g, '/')
      filesToCommitToday.push({ absolutePath: filePath, filePath: relPath })
      tempCommitsDone++
    }

    let aiMessageMap: Record<string, string> = {}
    if (useAI && filesToCommitToday.length > 0) {
      const generated = await generateBatchedMessages(filesToCommitToday, authorStyle)
      for (const g of generated) {
        if (g.file && g.message) {
          aiMessageMap[g.file] = g.message
        }
      }
    }

    for (let c = 0; c < commitsToday && commitsDone < desiredCommits; c++) {
      // Cycle through files if desiredCommits > totalFiles
      const currentFileIdx = commitsDone % totalFiles
      const filePath = allFiles[currentFileIdx]
      const relPath = relative(extractPath, filePath).replace(/\\/g, '/')
      const ts = timestamps[Math.min(c, timestamps.length - 1)]
      const author = pickAuthor(authors, rng)

      let message = aiMessageMap[relPath]
      if (!message) {
        message = generateMessage({
          filePath: relPath,
          index: commitsDone,
          total: desiredCommits,
          previousMessages,
          authorStyle,
        })
      }

      previousMessages.push(message)
      if (previousMessages.length > 25) previousMessages.shift()

      const committed = await stageAndCommit(
        extractPath,
        filePath,
        message,
        ts.authorDate,
        ts.committerDate,
        author
      )

      if (committed) {
        commitEntries.push({
          file: relPath,
          date: ts.authorDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          message,
          author: author.name,
          index: commitsDone,
        })
        onProgress?.(commitsDone + 1, desiredCommits, message, relPath)
        sinceLastMerge++
      }

      commitsDone++

      // Inject merge commit every 5-9 commits
      if (
        addMergeCommits &&
        sinceLastMerge >= Math.floor(rng() * 5) + 5 &&
        commitsDone < desiredCommits - 2
      ) {
        try {
          const mergeDate = new Date(ts.authorDate.getTime() + 120000)
          const mergeMessages = [
            `Merge branch 'feature/update-${commitsDone}'`,
            `Merge pull request #${Math.floor(rng() * 30) + 1} into ${safeBranch}`,
            `Merge remote-tracking branch 'origin/dev'`,
          ]
          const mergeMsg = mergeMessages[Math.floor(rng() * mergeMessages.length)]
          const nameEsc = author.name.replace(/"/g, "'")
          const emailEsc = author.email.replace(/"/g, "'")
          await gitExec(
            `git -c user.name="${nameEsc}" -c user.email="${emailEsc}" commit --allow-empty -m "${mergeMsg}"`,
            {
              GIT_AUTHOR_DATE: mergeDate.toISOString(),
              GIT_COMMITTER_DATE: mergeDate.toISOString(),
              GIT_AUTHOR_NAME: author.name,
              GIT_AUTHOR_EMAIL: author.email,
              GIT_COMMITTER_NAME: author.name,
              GIT_COMMITTER_EMAIL: author.email,
            },
            extractPath
          )
        } catch { /* merge commits optional */ }
        sinceLastMerge = 0
      }
    }
  }

  // Flush any remaining commits if day schedule ran short
  if (commitsDone < desiredCommits) {
    const lastDate = new Date(daySchedule[daySchedule.length - 1].date)
    let hourOffset = 0

    while (commitsDone < desiredCommits) {
      const currentFileIdx = commitsDone % totalFiles
      const filePath = allFiles[currentFileIdx]
      const relPath = relative(extractPath, filePath).replace(/\\/g, '/')
      const author = pickAuthor(authors, rng)

      const d = new Date(lastDate)
      d.setHours(10 + (hourOffset % 8), Math.floor(rng() * 60), 0, 0)
      const cd = new Date(d.getTime() + 90000)
      hourOffset++

      const message = generateMessage({
        filePath: relPath,
        index: commitsDone,
        total: desiredCommits,
        previousMessages,
        authorStyle,
      })

      const committed = await stageAndCommit(extractPath, filePath, message, d, cd, author)

      if (committed) {
        commitEntries.push({
          file: relPath,
          date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          message,
          author: author.name,
          index: commitsDone,
        })
        onProgress?.(commitsDone + 1, desiredCommits, message, relPath)
      }

      commitsDone++
    }
  }

  // Rename branch
  try {
    await gitExec(`git branch -M ${safeBranch}`, {}, extractPath)
  } catch { /* ok */ }

  return {
    commits: commitEntries,
    totalCommits: commitEntries.length,
    totalDays: daySchedule.length,
    startDate: startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    endDate: endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  }
}
