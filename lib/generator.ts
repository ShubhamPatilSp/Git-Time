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
  timezone?: string
  toggledOffDates?: string[]
  authorStyle: 'terse' | 'descriptive' | 'conventional'
  addMergeCommits: boolean
  excludeFolders: string[]
  useAI?: boolean
  fileTypeDensity?: Record<string, number>
  injectPRMerges?: boolean
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

function buildCoAuthorTrailer(allAuthors: Author[], primaryAuthor: Author): string {
  const coAuthors = allAuthors.filter(a => a.email !== primaryAuthor.email)
  if (coAuthors.length === 0) return ''
  const lines = coAuthors.map(ca => {
    const name = ca.name.replace(/"/g, "'")
    const email = ca.email.replace(/"/g, "'")
    return `Co-authored-by: ${name} <${email}>`
  })
  return '\n\n' + lines.join('\n')
}

async function initGitRepo(repoPath: string, author: Author, branchName: string): Promise<void> {
  await gitExec('git init', {}, repoPath)
  await gitExec(`git config user.name "${author.name}"`, {}, repoPath)
  await gitExec(`git config user.email "${author.email}"`, {}, repoPath)
  const safeBranch = branchName.replace(/[^a-zA-Z0-9/_-]/g, '') || 'main'
  await gitExec(`git symbolic-ref HEAD refs/heads/${safeBranch}`, {}, repoPath)
}

// --- Feature Branch Pool ---
const FEATURE_NAMES = [
  'user-auth', 'dashboard-ui', 'api-refactor', 'fix-login-bug', 'perf-improvements',
  'add-search', 'payment-flow', 'notification-system', 'dark-mode', 'settings-page',
  'mobile-responsive', 'data-export', 'onboarding-flow', 'error-handling', 'cache-layer',
  'ci-pipeline', 'rate-limiting', 'oauth-integration', 'file-upload', 'email-service',
]

async function spawnFeatureBranch(
  repoPath: string,
  mainBranch: string,
  prNumber: number,
  filePaths: string[],
  messages: string[],
  baseDate: Date,
  author: Author,
  rng: () => number,
  allAuthors: Author[] = []
): Promise<void> {
  const nameIdx = Math.floor(rng() * FEATURE_NAMES.length)
  const branchName = `feature/${FEATURE_NAMES[nameIdx]}-${prNumber}`

  try {
    await gitExec(`git checkout -b ${branchName}`, {}, repoPath)

    const nameEsc = author.name.replace(/"/g, "'")
    const emailEsc = author.email.replace(/"/g, "'")

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i]
      const message = messages[i] || `update ${filePath}`
      const d = new Date(baseDate.getTime() + i * 3600000)
      const safeMsg = message.replace(/\\/g, '').replace(/"/g, "'").replace(/`/g, '').replace(/\$/g, '').trim() || 'update file'
      const relPath = relative(repoPath, filePath).split('\\').join('/')

      try {
        await gitExec(`git add -- "${relPath}"`, {}, repoPath)
        const staged = await gitExec('git diff --cached --name-only', {}, repoPath)
        if (!staged?.trim()) continue
        const trailer = buildCoAuthorTrailer(allAuthors, author)
        const fullBranchMsg = safeMsg + trailer
        const branchMsgFile = join(repoPath, '.git', 'COMMIT_EDITMSG_TMP')
        await fsExtra.writeFile(branchMsgFile, fullBranchMsg)
        try {
          await gitExec(
            `git -c user.name="${nameEsc}" -c user.email="${emailEsc}" commit -F .git/COMMIT_EDITMSG_TMP`,
            {
              GIT_AUTHOR_DATE: d.toISOString(),
              GIT_COMMITTER_DATE: d.toISOString(),
              GIT_AUTHOR_NAME: author.name,
              GIT_AUTHOR_EMAIL: author.email,
              GIT_COMMITTER_NAME: author.name,
              GIT_COMMITTER_EMAIL: author.email,
            },
            repoPath
          )
        } finally { try { await fsExtra.remove(branchMsgFile) } catch {} }
      } catch { /* individual commit errors are non-fatal */ }
    }

    // Merge back to main with --no-ff (authentic PR merge graph)
    await gitExec(`git checkout ${mainBranch}`, {}, repoPath)
    const mergeDate = new Date(baseDate.getTime() + filePaths.length * 3600000 + 600000)
    const prMsg = `Merge pull request #${prNumber} from ${branchName}`

    try {
      await gitExec(
        `git -c user.name="${nameEsc}" -c user.email="${emailEsc}" merge --no-ff ${branchName} -m "${prMsg}"`,
        {
          GIT_AUTHOR_DATE: mergeDate.toISOString(),
          GIT_COMMITTER_DATE: mergeDate.toISOString(),
          GIT_AUTHOR_NAME: author.name,
          GIT_AUTHOR_EMAIL: author.email,
          GIT_COMMITTER_NAME: author.name,
          GIT_COMMITTER_EMAIL: author.email,
        },
        repoPath
      )
    } catch { /* merge may fail if nothing changed */ }

    try { await gitExec(`git branch -d ${branchName}`, {}, repoPath) } catch { /* ok */ }
  } catch {
    try { await gitExec(`git checkout ${mainBranch}`, {}, repoPath) } catch { /* ok */ }
  }
}

async function stageAndCommit(
  repoPath: string,
  filePath: string,
  message: string,
  authorDate: Date,
  committerDate: Date,
  author: Author,
  allAuthors: Author[] = []
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

  // Build full commit message with Co-authored-by trailers for green dots
  const trailer = buildCoAuthorTrailer(allAuthors, author)
  const fullMessage = safeMsg + trailer
  const msgFile = join(repoPath, '.git', 'COMMIT_EDITMSG_TMP')
  await fsExtra.writeFile(msgFile, fullMessage)

  try {
    await gitExec(
      `git -c user.name="${nameEsc}" -c user.email="${emailEsc}" commit -F .git/COMMIT_EDITMSG_TMP`,
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
  } finally {
    try { await fsExtra.remove(msgFile) } catch {}
  }
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
    timezone,
    toggledOffDates,
    authorStyle,
    addMergeCommits,
    excludeFolders,
    useAI,
    fileTypeDensity,
    injectPRMerges,
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

  // Build mathematical file pickers to adhere strictly to fileTypeDensity requested by user while preserving realistic organic feature-progression
  const extensionBuckets: Record<string, string[]> = {}
  allFiles.forEach(f => {
    const ext = f.split('.').pop()?.toLowerCase() || 'other'
    if (!extensionBuckets[ext]) extensionBuckets[ext] = []
    extensionBuckets[ext].push(f) // natural sorting is preserved inside the buckets
  })
  
  const actualDensity: { ext: string, weight: number }[] = []
  let totalActualWeight = 0
  if (fileTypeDensity && Object.keys(fileTypeDensity).length > 0) {
    for (const [ext, weight] of Object.entries(fileTypeDensity)) {
      if (extensionBuckets[ext] && extensionBuckets[ext].length > 0) {
        actualDensity.push({ ext, weight })
        totalActualWeight += weight
      }
    }
  }

  const otherFiles = allFiles.filter(f => !fileTypeDensity || !Object.keys(fileTypeDensity).includes(f.split('.').pop()?.toLowerCase() || ''))
  const hasOther = otherFiles.length > 0
  const residualWeight = Math.max(0, 100 - totalActualWeight)
  const rollTotal = totalActualWeight + (hasOther ? residualWeight : 0)

  // We maintain independent counters for each bucket so we organically progress through ALL files of that type realistically
  const bucketCounters: Record<string, number> = {}

  function pickFile(seqIndex: number): string {
    if (totalActualWeight === 0) {
      return allFiles[seqIndex % totalFiles]
    }
    
    let roll = rng() * rollTotal
    for (const { ext, weight } of actualDensity) {
      if (roll <= weight) {
        const bucket = extensionBuckets[ext]
        if (!bucketCounters[ext]) bucketCounters[ext] = 0
        const f = bucket[bucketCounters[ext] % bucket.length]
        bucketCounters[ext]++
        return f
      }
      roll -= weight
    }
    
    if (hasOther) {
      if (!bucketCounters['__other']) bucketCounters['__other'] = 0
      const f = otherFiles[bucketCounters['__other'] % otherFiles.length]
      bucketCounters['__other']++
      return f
    }
    
    return allFiles[seqIndex % totalFiles]
  }

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
    startDate.getTime(),
    toggledOffDates
  )

  if (daySchedule.length === 0) {
    throw new Error('No active days in selected date range. Try a wider range or different pattern.')
  }

  // Init repo
  const safeBranch = (branchName || 'main').replace(/[^a-zA-Z0-9/_-]/g, '')
  await initGitRepo(extractPath, authors[0], safeBranch)

  const commitEntries: CommitEntry[] = []
  const previousMessages: string[] = []
  let commitsDone = 0
  let sinceLastMerge = 0
  let sinceLastPR = 0
  let prNumber = Math.floor(Math.random() * 5) + 1
  const rng = seededRng(startDate.getTime())

  // Main commit loop — iterate over scheduled days
  for (const daySlot of daySchedule) {
    if (commitsDone >= desiredCommits) break

    const commitsToday = Math.min(daySlot.commitCount, desiredCommits - commitsDone)
    if (commitsToday === 0) continue

    // Pre-calculate files for today for AI batching AND commit loop
    const filesToCommitToday: {absolutePath: string, filePath: string}[] = []
    let tempCommitsDone = commitsDone
    for (let c = 0; c < commitsToday && tempCommitsDone < desiredCommits; c++) {
      const filePath = pickFile(tempCommitsDone)
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
      const filePath = filesToCommitToday[c].absolutePath
      const relPath = filesToCommitToday[c].filePath

      // Pick author FIRST, then generate timestamp using THEIR timezone
      const author = pickAuthor(authors, rng)
      const authorTimezone = (author as any).timezone || timezone || 'UTC'
      const singleTs = generateTimestamps(daySlot.date, 1, activePattern, daySlot.date.getTime() + c * 37, authorTimezone)
      const ts = singleTs[0]

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
        author,
        authors
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
        sinceLastPR++
      }

      commitsDone++

      // Inject real PR feature branch every 20-30 commits
      const prThreshold = Math.floor(rng() * 11) + 20
      if (injectPRMerges && sinceLastPR >= prThreshold && commitsDone < desiredCommits - 12) {
        const branchCommitCount = Math.floor(rng() * 6) + 5
        const branchFiles: string[] = []
        const branchMessages: string[] = []
        for (let bi = 0; bi < branchCommitCount; bi++) {
          const pickedFile = pickFile(commitsDone + bi)
          branchFiles.push(pickedFile)
          const bRelPath = relative(extractPath, pickedFile).replace(/\\/g, '/')
          branchMessages.push(generateMessage({ filePath: bRelPath, index: commitsDone + bi, total: desiredCommits, previousMessages, authorStyle }))
        }
        prNumber++
        await spawnFeatureBranch(extractPath, safeBranch, prNumber, branchFiles, branchMessages, ts.authorDate, author, rng, authors)
        sinceLastPR = 0
      }

      // Inject simple merge commit every 5-9 commits
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
      const filePath = pickFile(commitsDone)
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

      const committed = await stageAndCommit(extractPath, filePath, message, d, cd, author, authors)

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
