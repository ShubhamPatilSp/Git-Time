'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSession, signIn, signOut } from "next-auth/react"

// ─── Types ────────────────────────────────────────────────────────────────────
type WizardStep = 1 | 2 | 3 | 4 | 5
type Stage = 'idle' | 'uploading' | 'generating' | 'done' | 'error'
type AuthorStyle = 'descriptive' | 'terse' | 'conventional'
type PatternName = 'active-sprint' | 'side-project' | 'daily-grind' | 'weekend-warrior' | 'crunch-mode' | 'casual'

interface Author {
  name: string
  email: string
  weight: number
}

interface CommitEntry {
  file: string
  date: string
  message: string
  author: string
  index: number
}

interface GenerateResult {
  downloadUrl: string
  totalCommits: number
  totalDays: number
  startDate: string
  endDate: string
  commits: CommitEntry[]
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PATTERNS = [
  { id: 'active-sprint', label: 'Active Sprint', emoji: '🚀', desc: 'Heavy weekday activity, focused sprints' },
  { id: 'side-project', label: 'Side Project', emoji: '🌙', desc: 'Sporadic bursts, evenings & weekends' },
  { id: 'daily-grind', label: 'Daily Grind', emoji: '⚙️', desc: 'Consistent commits every day' },
  { id: 'weekend-warrior', label: 'Weekend Warrior', emoji: '🏄', desc: 'Most work on weekends' },
  { id: 'crunch-mode', label: 'Crunch Mode', emoji: '🔥', desc: 'Deadline-driven, late nights' },
  { id: 'casual', label: 'Casual', emoji: '☕', desc: 'Relaxed, occasional commits' },
]

const AUTHOR_STYLES = [
  { id: 'descriptive', label: 'Descriptive', example: 'implement user authentication service' },
  { id: 'terse', label: 'Terse', example: 'auth service' },
  { id: 'conventional', label: 'Conventional', example: 'feat(auth): add user authentication' },
]

const STEPS = [
  { n: 1, label: 'Identity' },
  { n: 2, label: 'Upload' },
  { n: 3, label: 'Timeline' },
  { n: 4, label: 'Style' },
  { n: 5, label: 'Generate' },
]

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10)
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Home() {
  const [step, setStep] = useState<WizardStep>(1)
  const [stage, setStage] = useState<Stage>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Step 1 – Identity
  const [authors, setAuthors] = useState<Author[]>([{ name: '', email: '', weight: 100 }])
  const [githubToken, setGithubToken] = useState('')
  const [githubUser, setGithubUser] = useState<{ username: string; email?: string } | null>(null)
  const [tokenValidating, setTokenValidating] = useState(false)
  const [tokenError, setTokenError] = useState('')

  // Step 2 – Upload
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [fileCount, setFileCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Step 3 – Timeline
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return toDateInputValue(d)
  })
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()))
  const [pattern, setPattern] = useState<PatternName>('daily-grind')
  const [weekdaysOnly, setWeekdaysOnly] = useState(false)
  const [totalCommits, setTotalCommits] = useState<number | null>(null) // null = auto (= fileCount)

  // Step 4 – Style
  const [authorStyle, setAuthorStyle] = useState<AuthorStyle>('descriptive')
  const [branchName, setBranchName] = useState('main')
  const [addMergeCommits, setAddMergeCommits] = useState(true)
  const [excludeFolders, setExcludeFolders] = useState('node_modules,dist,build,.next')

  // Step 5 – Results
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [visibleCommits, setVisibleCommits] = useState<CommitEntry[]>([])
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')
  const [pushingToGithub, setPushingToGithub] = useState(false)
  const [repoName, setRepoName] = useState('')
  const [isPrivateRepo, setIsPrivateRepo] = useState(false)
  const [pushResult, setPushResult] = useState<{ repoUrl: string } | null>(null)

  const { data: session, status } = useSession()

  // Auto-fill author email from GitHub if available
  useEffect(() => {
    if (session?.user && authors[0].name === '' && authors[0].email === '') {
      setAuthors(prev => prev.map((a, i) => i === 0 ? {
        ...a,
        name: session.user.name || session.user.email?.split('@')[0] || 'Developer',
        email: session.user.email || 'dev@example.com',
      } : a))
      setRepoName('my-project')
    }
  }, [session])

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const validateToken = async () => {
    if (!githubToken.trim()) return
    setTokenValidating(true)
    setTokenError('')
    try {
      const res = await fetch('/api/github/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubToken }),
      })
      const data = await res.json()
      if (!res.ok) { setTokenError(data.error); return }
      setGithubUser(data)
    } catch { setTokenError('Connection failed') }
    finally { setTokenValidating(false) }
  }

  const validateAndSetFile = (f: File) => {
    if (!f.name.endsWith('.zip')) { setErrorMsg('Only .zip files accepted'); return }
    if (f.size > 150 * 1024 * 1024) { setErrorMsg('Max 150MB'); return }
    setFile(f); setErrorMsg(''); setSessionId(null)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) validateAndSetFile(f)
  }, [])

  const uploadFile = async () => {
    if (!file) return
    setStage('uploading')
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSessionId(data.sessionId)
      setFileCount(data.fileCount || 0)
      setStage('idle')
      setStep(3)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
      setStage('error')
    }
  }

  const handleGenerate = async () => {
    if (!sessionId) return
    setStage('generating')
    setProgress(0)
    setProgressMsg('Initializing repository...')
    setResult(null)
    setVisibleCommits([])
    setErrorMsg('')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          startDate,
          endDate,
          authors: authors.filter(a => a.name && a.email),
          patternName: pattern,
          totalCommits: totalCommits ?? undefined,
          branchName: branchName || 'main',
          weekdaysOnly,
          authorStyle,
          addMergeCommits,
          excludeFolders: excludeFolders.split(',').map(s => s.trim()).filter(Boolean),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setResult(data)
      setStage('done')
      setProgress(100)
      setProgressMsg('Complete!')

      // Animate commits appearing
      data.commits.forEach((commit: CommitEntry, i: number) => {
        setTimeout(() => setVisibleCommits(prev => [...prev, commit]), i * 40)
      })
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Generation failed')
      setStage('error')
    }
  }

  const handlePushToGithub = async () => {
    if (!sessionId || !repoName) return
    setPushingToGithub(true)
    try {
      const res = await fetch('/api/github/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          token: githubToken,
          repoName,
          isPrivate: isPrivateRepo,
          branchName: branchName || 'main',
          description: 'Generated with GitTime',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPushResult({ repoUrl: data.repoUrl })
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Push failed')
    } finally {
      setPushingToGithub(false)
    }
  }

  const canProceed = () => {
    if (step === 1) return authors[0].name.trim() !== '' && authors[0].email.trim() !== ''
    if (step === 2) return sessionId !== null
    if (step === 3) return startDate && endDate && new Date(startDate) < new Date(endDate)
    if (step === 4) return branchName.trim() !== ''
    return false
  }

  const dayCount = Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))

  // ─── Render helpers ──────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Authenticated Account</h2>
        <p className="text-sm text-white/40">You are securely signed in via GitHub. Contributions will be mapped securely.</p>
      </div>

      {session?.user && (
        <div className="flex items-center gap-4 p-4 rounded-xl border border-brand-green/30 bg-brand-green/5">
          {session.user.image && <img src={session.user.image} alt="avatar" className="w-12 h-12 rounded-full border border-brand-green/50" />}
          <div>
            <p className="font-mono text-sm font-semibold text-brand-green">{session.user.name || 'Developer'}</p>
            <p className="font-mono text-xs text-white/50">{session.user.email}</p>
          </div>
          <button onClick={() => signOut()} className="ml-auto px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-white/40 hover:bg-white/10 transition-colors">Sign Out</button>
        </div>
      )}

      {/* Primary author */}
      <div className="space-y-3">
        {authors.map((author, i) => (
          <div key={i} className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-white/40 uppercase tracking-widest">
                {i === 0 ? 'Primary Identity' : `Co-author ${i}`}
              </span>
              {i > 0 && (
                <button onClick={() => setAuthors(prev => prev.filter((_, idx) => idx !== i))}
                  className="font-mono text-xs text-red-400/60 hover:text-red-400 transition-colors">
                  remove
                </button>
              )}
            </div>
            {i > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs text-white/30 mb-1.5">Name</label>
                  <input type="text" value={author.name} placeholder="Shubham Patil"
                    onChange={e => setAuthors(prev => prev.map((a, idx) => idx === i ? { ...a, name: e.target.value } : a))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 font-mono focus:outline-none focus:border-brand-green/50 transition-colors" />
                </div>
                <div>
                  <label className="block font-mono text-xs text-white/30 mb-1.5">Email</label>
                  <input type="email" value={author.email} placeholder="you@gmail.com"
                    onChange={e => setAuthors(prev => prev.map((a, idx) => idx === i ? { ...a, email: e.target.value } : a))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 font-mono focus:outline-none focus:border-brand-green/50 transition-colors" />
                </div>
              </div>
            )}
            {authors.length > 1 && (
              <div>
                <label className="block font-mono text-xs text-white/30 mb-1.5">Commit share: {author.weight}%</label>
                <input type="range" min="10" max="90" value={author.weight}
                  onChange={e => setAuthors(prev => prev.map((a, idx) => idx === i ? { ...a, weight: Number(e.target.value) } : a))}
                  className="w-full" />
              </div>
            )}
          </div>
        ))}
        {authors.length < 3 && (
          <button onClick={() => setAuthors(prev => [...prev, { name: '', email: '', weight: 30 }])}
            className="w-full py-2.5 rounded-xl border border-dashed border-white/20 font-mono text-xs text-white/30 hover:text-white/50 hover:border-white/25 transition-all">
            + add co-author
          </button>
        )}
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Upload your project</h2>
        <p className="text-sm text-white/40">Zip your entire project folder and upload it here.</p>
      </div>

      <div
        className={`file-drop-zone rounded-xl p-10 text-center cursor-pointer ${isDragging ? 'dragging' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
      >
        <input ref={fileInputRef} type="file" accept=".zip" onChange={e => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f) }} className="hidden" />
        {file ? (
          <div className="animate-fadeIn">
            <div className="w-14 h-14 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,255,135,0.1)', border: '1px solid rgba(0,255,135,0.3)' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 5h8l4 4v9a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" stroke="#00ff87" strokeWidth="1.5" /><path d="M13 5v4h4" stroke="#00ff87" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </div>
            <p className="font-mono text-sm text-brand-green font-semibold">{file.name}</p>
            <p className="font-mono text-xs text-muted mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            {sessionId && <p className="font-mono text-xs text-brand-green/60 mt-2">✓ Uploaded — {fileCount} files detected</p>}
            <button onClick={e => { e.stopPropagation(); setFile(null); setSessionId(null) }}
              className="mt-3 font-mono text-xs text-muted hover:text-white/50 underline transition-colors">remove</button>
          </div>
        ) : (
          <div>
            <div className="w-14 h-14 mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M11 3v12M7 8l4-5 4 5" stroke="#4a4a6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" stroke="#4a4a6a" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </div>
            <p className="font-sans text-sm text-white/40">Drop your <span className="font-mono text-brand-green/70">.zip</span> here</p>
            <p className="font-mono text-xs text-muted mt-1">or click to browse · max 150MB</p>
          </div>
        )}
      </div>

      {file && !sessionId && (
        <button onClick={uploadFile} disabled={stage === 'uploading'}
          className="btn-primary w-full rounded-xl py-3.5 text-sm">
          <span className="flex items-center justify-center gap-2">
            {stage === 'uploading' ? (
              <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" /></svg>Uploading...</>
            ) : 'Upload & Continue →'}
          </span>
        </button>
      )}

      {/* Exclude folders hint */}
      <div className="p-3 rounded-xl border border-white/5 bg-white/5">
        <p className="font-mono text-xs text-white/25">
          Auto-excluded: <span className="text-white/40">node_modules, .git, dist, build, .next, *.lock, images, binaries</span>
        </p>
      </div>
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Configure the timeline</h2>
        <p className="text-sm text-white/40">Set the date range and activity pattern for your commit history.</p>
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block font-mono text-xs text-white/40 uppercase tracking-widest mb-2">Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            max={endDate}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-brand-green/50 transition-colors" />
        </div>
        <div>
          <label className="block font-mono text-xs text-white/40 uppercase tracking-widest mb-2">End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            min={startDate} max={toDateInputValue(new Date())}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-brand-green/50 transition-colors" />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5">
        <span className="font-mono text-xs text-white/40">{dayCount} days · ~{fileCount} commits total</span>
        <span className="font-mono text-xs text-brand-green">{fileCount > 0 ? `≈${Math.ceil(fileCount / Math.max(dayCount, 1))} commits/day` : ''}</span>
      </div>

      {/* Pattern selector */}
      <div>
        <label className="block font-mono text-xs text-white/40 uppercase tracking-widest mb-3">Activity Pattern</label>
        <div className="grid grid-cols-2 gap-2">
          {PATTERNS.map(p => (
            <button key={p.id} onClick={() => setPattern(p.id as PatternName)}
              className={`p-3 rounded-xl text-left transition-all border ${pattern === p.id ? 'border-brand-green/40 bg-brand-green/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{p.emoji}</span>
                <span className={`font-mono text-xs font-semibold ${pattern === p.id ? 'text-brand-green' : 'text-white/70'}`}>{p.label}</span>
              </div>
              <p className="font-sans text-xs text-white/30 leading-tight">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Weekdays only */}
      <label className="flex items-center gap-3 cursor-pointer group">
        <div className={`w-10 rounded-full transition-colors relative ${weekdaysOnly ? 'bg-brand-green' : 'bg-white/10'}`} style={{ height: '22px' }}
          onClick={() => setWeekdaysOnly(p => !p)}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${weekdaysOnly ? 'translate-x-5' : 'translate-x-0.5'}`} style={{ margin: '1px' }} />
        </div>
        <div>
          <p className="font-mono text-sm text-white/70">Weekdays only</p>
          <p className="font-mono text-xs text-white/25">No commits on Saturday or Sunday</p>
        </div>
      </label>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Commit style & settings</h2>
        <p className="text-sm text-white/40">Fine-tune how commits look and feel.</p>
      </div>

      {/* Author style */}
      <div>
        <label className="block font-mono text-xs text-white/40 uppercase tracking-widest mb-3">Commit Message Style</label>
        <div className="space-y-2">
          {AUTHOR_STYLES.map(s => (
            <button key={s.id} onClick={() => setAuthorStyle(s.id as AuthorStyle)}
              className={`w-full p-3.5 rounded-xl text-left transition-all border ${authorStyle === s.id ? 'border-brand-cyan/40 bg-brand-cyan/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`font-mono text-xs font-semibold ${authorStyle === s.id ? 'text-brand-cyan' : 'text-white/60'}`}>{s.label}</span>
                {authorStyle === s.id && <span className="font-mono text-xs text-brand-cyan/60">selected</span>}
              </div>
              <p className="font-mono text-xs text-white/25 italic">"{s.example}"</p>
            </button>
          ))}
        </div>
      </div>

      {/* Branch name */}
      <div>
        <label className="block font-mono text-xs text-white/40 uppercase tracking-widest mb-2">Branch Name</label>
        <input type="text" value={branchName} onChange={e => setBranchName(e.target.value)}
          placeholder="main"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-brand-green/50 transition-colors" />
      </div>

      {/* Exclude folders */}
      <div>
        <label className="block font-mono text-xs text-white/40 uppercase tracking-widest mb-2">Additional Exclude Folders</label>
        <input type="text" value={excludeFolders} onChange={e => setExcludeFolders(e.target.value)}
          placeholder="folder1, folder2, ..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-brand-green/50 transition-colors" />
        <p className="font-mono text-xs text-white/20 mt-1.5">comma-separated folder names to skip</p>
      </div>

      {/* Merge commits toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div className={`relative rounded-full transition-colors`}
          style={{ width: '40px', height: '22px', background: addMergeCommits ? '#00ff87' : 'rgba(255,255,255,0.1)' }}
          onClick={() => setAddMergeCommits(p => !p)}>
          <div className={`absolute top-0 w-4 h-4 rounded-full bg-white shadow transition-transform`}
            style={{ margin: '3px', transform: addMergeCommits ? 'translateX(18px)' : 'translateX(0)' }} />
        </div>
        <div>
          <p className="font-mono text-sm text-white/70">Inject merge commits</p>
          <p className="font-mono text-xs text-white/25">Adds realistic merge commits every 5–9 commits</p>
        </div>
      </label>
    </div>
  )

  const renderStep5 = () => (
    <div className="space-y-5 animate-fadeIn">
      {stage === 'idle' && !result && (
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,255,135,0.08)', border: '1px solid rgba(0,255,135,0.2)' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="8" cy="7" r="3" stroke="#00ff87" strokeWidth="1.5" /><circle cx="20" cy="7" r="3" stroke="#00ff87" strokeWidth="1.5" /><circle cx="14" cy="21" r="3" stroke="#00ff87" strokeWidth="1.5" /><line x1="8" y1="10" x2="14" y2="18" stroke="#00ff87" strokeWidth="1.5" strokeLinecap="round" /><line x1="20" y1="10" x2="14" y2="18" stroke="#00ff87" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Ready to generate</h2>
          <div className="grid grid-cols-3 gap-3 mb-6 text-center">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="font-mono text-lg font-bold text-brand-green">{fileCount}</p>
              <p className="font-mono text-xs text-muted">files</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="font-mono text-lg font-bold text-brand-cyan">{dayCount}</p>
              <p className="font-mono text-xs text-muted">days</p>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
              <p className="font-mono text-lg font-bold text-brand-amber">{authors.filter(a => a.name).length}</p>
              <p className="font-mono text-xs text-muted">authors</p>
            </div>
          </div>
          <button onClick={handleGenerate} className="btn-primary w-full rounded-xl py-4 text-sm">
            <span className="flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v5l3-3M2 8a6 6 0 1012 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              Generate Commit Timeline
            </span>
          </button>
        </div>
      )}

      {stage === 'generating' && (
        <div className="text-center py-4 animate-fadeIn">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center border border-brand-green/30 animate-spin" style={{ borderTopColor: '#00ff87' }} />
          <p className="font-mono text-sm text-brand-green mb-2">{progressMsg || 'Generating...'}</p>
          <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full shimmer-bar" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #00ff87, #00d4ff)' }} />
          </div>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="space-y-4 animate-fadeIn">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-brand-green/20 bg-brand-green/5">
              <p className="font-mono text-3xl font-bold text-brand-green">{result.totalCommits}</p>
              <p className="font-mono text-xs text-muted mt-1">commits generated</p>
            </div>
            <div className="p-4 rounded-xl border border-brand-cyan/20 bg-brand-cyan/10">
              <p className="font-mono text-3xl font-bold text-brand-cyan">{result.totalDays}</p>
              <p className="font-mono text-xs text-muted mt-1">active days</p>
            </div>
          </div>
          <p className="font-mono text-xs text-white/30 text-center">{result.startDate} → {result.endDate}</p>

          {/* Download */}
          <a href={result.downloadUrl} download className="btn-download flex items-center justify-center gap-2 w-full rounded-xl py-3.5 text-sm font-semibold">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            Download Repository ZIP
          </a>

          {/* Push to GitHub */}
          {session?.user && !pushResult && (
            <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-3">
              <p className="font-mono text-xs text-white/40 uppercase tracking-widest">Push to GitHub</p>
              <div className="flex gap-2">
                <input type="text" value={repoName} onChange={e => setRepoName(e.target.value)}
                  placeholder="my-project"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-brand-green/50" />
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={isPrivateRepo} onChange={e => setIsPrivateRepo(e.target.checked)} className="accent-brand-green" />
                  <span className="font-mono text-xs text-white/40">private</span>
                </label>
              </div>
              <button onClick={handlePushToGithub} disabled={pushingToGithub || !repoName}
                className="btn-primary w-full rounded-xl py-2.5 text-sm disabled:opacity-40">
                <span className="flex items-center justify-center gap-2">
                  {pushingToGithub ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="30 70" /></svg>Pushing...</> : '→ Push to GitHub'}
                </span>
              </button>
            </div>
          )}

          {pushResult && (
            <a href={pushResult.repoUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-brand-green/30 bg-brand-green/10 font-mono text-sm text-brand-green hover:bg-brand-green/15 transition-colors">
              ✓ View on GitHub →
            </a>
          )}

          {/* Regenerate */}
          <button onClick={() => { setStage('idle'); setResult(null); setVisibleCommits([]) }}
            className="w-full py-2.5 font-mono text-xs text-white/25 hover:text-white/50 transition-colors">
            ↺ regenerate with different settings
          </button>
        </div>
      )}

    </div>
  )

  const stepContent = [null, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5]

  // ─── Render Landing Page ───────────────────────────────────────────────────────
  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center pt-20"><div className="w-10 h-10 border-2 border-brand-green rounded-full animate-spin border-t-transparent" /></div>
  }

  if (status === "unauthenticated") {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* Animated Orbs */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[10%] left-[20%] w-[600px] h-[600px] rounded-full blur-[120px] opacity-20" style={{ background: 'linear-gradient(135deg, #00ff87, #00d4ff)' }} />
          <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] rounded-full blur-[100px] opacity-10" style={{ background: '#00d4ff' }} />
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 text-center">
          <p className="font-mono text-sm text-brand-green/80 uppercase tracking-[0.3em] mb-6 glow-text-green">$ git commit --history --legendary</p>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-tight mb-8">
            Undetectable <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #00ff87, #00d4ff)' }}>Commit History</span><br />Generator
          </h1>
          <p className="text-lg md:text-xl text-white/50 mb-12 max-w-2xl mx-auto leading-relaxed">
            Turn empty projects into bustling, battle-tested repositories. Backdate realistic commit workflows directly into your GitHub account with a single click.
          </p>

          <button onClick={() => signIn('github')} className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-mono text-sm font-bold text-black transition-all hover:scale-105 active:scale-95" style={{ background: 'linear-gradient(135deg, #00ff87, #00d4ff)' }}>
            <div className="absolute inset-0 rounded-2xl opacity-50 group-hover:opacity-100 blur transition-opacity" style={{ background: 'inherit' }} />
            <svg className="relative z-10 w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
            <span className="relative z-10">Sign in with GitHub to start →</span>
          </button>
        </div>

        <div className="relative z-10 mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto px-6">
          {[
            { title: "Completely Undetectable", desc: "Randomized committer dates, varied file lengths, and advanced GitHub patterns." },
            { title: "One-Click Push", desc: "No more downloading zips or typing terminal commands. We push directly via OAuth." },
            { title: "AI-Ready Flexibility", desc: "Generate 50 to 5,000 commits matching realistic, backdated developer activity." }
          ].map((feature, idx) => (
            <div key={idx} className="p-6 rounded-3xl border border-white/10 bg-black/40 backdrop-blur-md">
              <h3 className="font-mono text-sm text-brand-green mb-2 glow-text-green">{feature.title}</h3>
              <p className="text-white/40 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[30%] w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,255,135,0.05) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 right-[20%] w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="border-b border-white/5 px-6 py-4 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #00ff87, #00d4ff)' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="4" cy="4" r="2" fill="#0a0a0f" /><circle cx="12" cy="4" r="2" fill="#0a0a0f" /><circle cx="8" cy="12" r="2" fill="#0a0a0f" /><line x1="4" y1="6" x2="8" y2="10" stroke="#0a0a0f" strokeWidth="1.5" /><line x1="12" y1="6" x2="8" y2="10" stroke="#0a0a0f" strokeWidth="1.5" /></svg>
              </div>
              <span className="font-mono text-sm font-semibold tracking-wider text-white/90">GITTIME</span>
              <span className="font-mono text-xs text-white/20 border border-white/10 px-2 py-0.5 rounded-full">v2.0 PRO</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse-slow shadow-[0_0_8px_#00ff87]" />
              <button onClick={() => signOut()} className="font-mono text-xs text-white/40 hover:text-white transition-colors">Sign Out</button>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto w-full px-6 py-10 flex-1">
          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left: wizard */}
            <div className="lg:col-span-3">
              {/* Tagline */}
              <div className="mb-8">
                <p className="font-mono text-xs text-brand-green/60 tracking-widest uppercase mb-2">$ git commit --backdate --realistic</p>
                <h1 className="text-3xl font-bold text-white leading-tight">
                  Undetectable commit<br />
                  <span style={{ color: '#00ff87' }} className="glow-text-green">history generator</span>
                </h1>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-1 mb-8">
                {STEPS.map((s, i) => (
                  <div key={s.n} className="flex items-center gap-1">
                    <button
                      onClick={() => { if (s.n < step || (s.n === step + 1 && canProceed())) setStep(s.n as WizardStep) }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs transition-all ${step === s.n ? 'bg-brand-green/15 text-brand-green border border-brand-green/30' :
                          step > s.n ? 'text-white/40 hover:text-white/60' : 'text-white/20'
                        }`}
                    >
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${step > s.n ? 'bg-brand-green/20 text-brand-green' :
                          step === s.n ? 'bg-brand-green text-black' : 'bg-white/10 text-white/30'
                        }`}>
                        {step > s.n ? '✓' : s.n}
                      </span>
                      {s.label}
                    </button>
                    {i < STEPS.length - 1 && <div className={`w-4 h-px ${step > s.n ? 'bg-brand-green/30' : 'bg-white/10'}`} />}
                  </div>
                ))}
              </div>

              {/* Step content */}
              <div className="glass-card rounded-2xl p-6 min-h-[420px]">
                {stepContent[step]?.()}

                {stage === 'error' && (
                  <div className="mt-6 p-4 rounded-xl border border-red-500/30 bg-red-500/8 animate-fadeIn">
                    <p className="font-mono text-sm text-red-400 font-semibold mb-1">Error</p>
                    <p className="font-mono text-xs text-red-300/80">{errorMsg}</p>
                    <button onClick={() => { setStage('idle'); setErrorMsg('') }} className="mt-3 font-mono text-xs text-white/40 hover:text-white/60 transition-colors underline">dismiss & try again</button>
                  </div>
                )}
              </div>

              {/* Nav buttons */}
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={() => setStep(s => Math.max(1, s - 1) as WizardStep)}
                  className={`font-mono text-sm text-white/30 hover:text-white/60 transition-colors ${step === 1 ? 'invisible' : ''}`}
                >
                  ← back
                </button>
                {step < 5 && (
                  <button
                    onClick={() => {
                      if (step === 2 && !sessionId) { uploadFile(); return }
                      setStep(s => Math.min(5, s + 1) as WizardStep)
                    }}
                    disabled={!canProceed() && !(step === 2 && file)}
                    className="btn-primary px-6 py-2.5 rounded-xl text-sm disabled:opacity-30"
                  >
                    <span>{step === 2 && !sessionId ? 'Upload & Continue' : step === 4 ? 'Review & Generate →' : 'Continue →'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right: commit log */}
            <div className="lg:col-span-2 space-y-4">
              {/* Heatmap preview */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <span className="font-mono text-xs text-white/40 uppercase tracking-widest">contribution preview</span>
                </div>
                <div className="p-4">
                  <HeatmapPreview startDate={startDate} endDate={endDate} pattern={pattern} weekdaysOnly={weekdaysOnly} fileCount={fileCount} />
                </div>
              </div>

              {/* Git log */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                  <span className="font-mono text-xs text-white/40 uppercase tracking-widest">git log</span>
                  {result && <span className="font-mono text-xs text-muted">{visibleCommits.length}/{result.totalCommits}</span>}
                </div>
                <div className="p-3 max-h-72 overflow-y-auto">
                  {visibleCommits.length > 0 ? (
                    <div className="space-y-0">
                      {visibleCommits.map((commit, i) => (
                        <div key={i} className="commit-dot flex items-start gap-2 py-1.5 border-b border-white/3 last:border-0">
                          <div className="flex flex-col items-center mt-1.5 flex-shrink-0">
                            <div className="w-2 h-2 rounded-full" style={{ background: i === 0 ? '#00ff87' : 'rgba(0,255,135,0.25)', boxShadow: i === 0 ? '0 0 6px #00ff87' : 'none' }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs text-white/75 truncate">{commit.message}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-xs text-muted truncate max-w-[90px]">{commit.file.split('/').pop()}</span>
                              <span className="font-mono text-xs text-subtle">{commit.date}</span>
                              {commit.author && <span className="font-mono text-xs text-white/20 truncate">{commit.author.split(' ')[0]}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <p className="font-mono text-xs text-subtle">{stage === 'generating' ? 'generating...' : 'commits will appear here'}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Anti-detection checklist */}
              <div className="glass-card rounded-2xl p-4">
                <p className="font-mono text-xs text-white/30 uppercase tracking-widest mb-3">Realism checks</p>
                <div className="space-y-2">
                  {[
                    { label: 'Varied commit times', ok: true },
                    { label: 'Non-uniform daily density', ok: true },
                    { label: 'Author + committer date offset', ok: true },
                    { label: 'Realistic commit order', ok: true },
                    { label: 'Context-aware messages', ok: true },
                    { label: 'Merge commits', ok: addMergeCommits },
                    { label: 'Weekday bias', ok: weekdaysOnly || pattern !== 'casual' },
                  ].map((check, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={`font-mono text-xs ${check.ok ? 'text-brand-green' : 'text-white/20'}`}>{check.ok ? '✓' : '○'}</span>
                      <span className={`font-mono text-xs ${check.ok ? 'text-white/50' : 'text-white/20'}`}>{check.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="border-t border-white/5 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <span className="font-mono text-xs text-subtle">GITTIME v2.0 — undetectable commit history</span>
            <span className="font-mono text-xs text-subtle">files auto-deleted after 15 min</span>
          </div>
        </footer>
      </div>
    </div>
  )
}

// ─── Heatmap Component ────────────────────────────────────────────────────────
function HeatmapPreview({ startDate, endDate, pattern, weekdaysOnly, fileCount }: {
  startDate: string; endDate: string; pattern: PatternName; weekdaysOnly: boolean; fileCount: number
}) {
  const cells = []
  if (!startDate || !endDate) return <div className="font-mono text-xs text-subtle text-center py-4">set dates to preview</div>

  const start = new Date(startDate)
  const end = new Date(endDate)
  const total = Math.min(Math.round((end.getTime() - start.getTime()) / 86400000) + 1, 365)

  const DENSITY: Record<PatternName, number[]> = {
    'active-sprint': [0, 3, 4, 5, 4, 3, 1],
    'side-project': [1, 0, 0, 1, 2, 3, 2],
    'daily-grind': [1, 2, 2, 2, 2, 2, 1],
    'weekend-warrior': [3, 0, 0, 0, 1, 4, 4],
    'crunch-mode': [2, 4, 5, 6, 5, 4, 3],
    'casual': [0, 1, 0, 1, 1, 0, 1],
  }

  const weights = DENSITY[pattern] || DENSITY['daily-grind']
  const days: number[] = []

  for (let i = 0; i < Math.min(total, 105); i++) {
    const d = new Date(start); d.setDate(d.getDate() + i)
    const dow = d.getDay()
    if (weekdaysOnly && (dow === 0 || dow === 6)) { days.push(0); continue }
    days.push(weights[dow])
  }

  const max = Math.max(...days, 1)

  return (
    <div>
      <div className="flex flex-wrap gap-0.5">
        {days.map((v, i) => {
          const intensity = v / max
          const color = intensity === 0 ? 'rgba(255,255,255,0.04)' :
            intensity < 0.3 ? 'rgba(0,255,135,0.15)' :
              intensity < 0.6 ? 'rgba(0,255,135,0.35)' :
                intensity < 0.85 ? 'rgba(0,255,135,0.6)' : '#00ff87'
          return <div key={i} className="rounded-sm" style={{ width: '9px', height: '9px', background: color }} />
        })}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="font-mono text-xs text-subtle">less</span>
        <div className="flex gap-1">
          {['rgba(255,255,255,0.04)', 'rgba(0,255,135,0.15)', 'rgba(0,255,135,0.35)', 'rgba(0,255,135,0.6)', '#00ff87'].map((c, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
          ))}
        </div>
        <span className="font-mono text-xs text-subtle">more</span>
      </div>
    </div>
  )
}
