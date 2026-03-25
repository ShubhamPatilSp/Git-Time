'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

export type WizardStep = 1 | 2 | 3 | 4 | 5
export type Stage = 'idle' | 'uploading' | 'generating' | 'done' | 'error'
export type AuthorStyle = 'descriptive' | 'terse' | 'conventional'
export type PatternName = 'active-sprint' | 'side-project' | 'daily-grind' | 'weekend-warrior' | 'crunch-mode' | 'casual'

export interface Author {
  name: string
  email: string
  weight: number
  timezone?: string
}

export interface CommitEntry {
  file: string
  date: string
  message: string
  author: string
  index: number
}

export interface GenerateResult {
  downloadUrl: string
  totalCommits: number
  totalDays: number
  startDate: string
  endDate: string
  commits: CommitEntry[]
}

interface WizardState {
  step: WizardStep
  setStep: React.Dispatch<React.SetStateAction<WizardStep>>
  stage: Stage
  setStage: React.Dispatch<React.SetStateAction<Stage>>
  errorMsg: string
  setErrorMsg: React.Dispatch<React.SetStateAction<string>>

  // Step 1 - Identity
  authors: Author[]
  setAuthors: React.Dispatch<React.SetStateAction<Author[]>>
  githubToken: string
  setGithubToken: React.Dispatch<React.SetStateAction<string>>
  
  // Step 2 - Upload
  file: File | null
  setFile: React.Dispatch<React.SetStateAction<File | null>>
  sessionId: string | null
  setSessionId: React.Dispatch<React.SetStateAction<string | null>>
  fileCount: number
  setFileCount: React.Dispatch<React.SetStateAction<number>>
  
  // Step 3 - Timeline
  startDate: string
  setStartDate: React.Dispatch<React.SetStateAction<string>>
  endDate: string
  setEndDate: React.Dispatch<React.SetStateAction<string>>
  pattern: PatternName
  setPattern: React.Dispatch<React.SetStateAction<PatternName>>
  weekdaysOnly: boolean
  setWeekdaysOnly: React.Dispatch<React.SetStateAction<boolean>>
  totalCommits: number | null
  setTotalCommits: React.Dispatch<React.SetStateAction<number | null>>
  timezone: string
  setTimezone: React.Dispatch<React.SetStateAction<string>>
  toggledOffDates: Record<string, boolean>
  setToggledOffDates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>

  // Step 4 - Style
  authorStyle: AuthorStyle
  setAuthorStyle: React.Dispatch<React.SetStateAction<AuthorStyle>>
  branchName: string
  setBranchName: React.Dispatch<React.SetStateAction<string>>
  addMergeCommits: boolean
  setAddMergeCommits: React.Dispatch<React.SetStateAction<boolean>>
  excludeFolders: string
  setExcludeFolders: React.Dispatch<React.SetStateAction<string>>
  injectPRMerges: boolean
  setInjectPRMerges: React.Dispatch<React.SetStateAction<boolean>>
  useAI: boolean
  setUseAI: React.Dispatch<React.SetStateAction<boolean>>
  fileTypeDensity: Record<string, number>
  setFileTypeDensity: React.Dispatch<React.SetStateAction<Record<string, number>>>

  // Step 5 - Generate
  result: GenerateResult | null
  setResult: React.Dispatch<React.SetStateAction<GenerateResult | null>>
  visibleCommits: CommitEntry[]
  setVisibleCommits: React.Dispatch<React.SetStateAction<CommitEntry[]>>
  progress: number
  setProgress: React.Dispatch<React.SetStateAction<number>>
  progressMsg: string
  setProgressMsg: React.Dispatch<React.SetStateAction<string>>
  uploadFile: () => Promise<void>
}

const WizardContext = createContext<WizardState | undefined>(undefined)

export function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10)
}

export const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: '🌍 UTC / Random' },
  { value: 'America/Los_Angeles', label: '🇺🇸 Silicon Valley (PST)' },
  { value: 'America/New_York', label: '🇺🇸 New York (EST)' },
  { value: 'Europe/London', label: '🇬🇧 London (GMT)' },
  { value: 'Europe/Berlin', label: '🇩🇪 Berlin (CET)' },
  { value: 'Asia/Calcutta', label: '🇮🇳 India (IST)' },
  { value: 'Asia/Tokyo', label: '🇯🇵 Tokyo (JST)' },
  { value: 'Australia/Sydney', label: '🇦🇺 Sydney (AEST)' },
]

export const AUTHOR_STYLES = [
  { id: 'descriptive', label: 'Descriptive', badge: 'Natural', badgeClass: 'bg-slate-500/20 text-slate-400', example: 'implement user authentication service' },
  { id: 'terse', label: 'Terse', badge: 'Quick', badgeClass: 'bg-blue-500/20 text-blue-400', example: 'auth service' },
  { id: 'conventional', label: 'Conventional', badge: 'Standard', badgeClass: 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/30', example: 'feat(auth): add user authentication' },
]

export const PATTERNS = [
  { id: 'active-sprint', label: 'Active Sprint', emoji: '🚀', desc: 'Heavy weekday activity, focused sprints' },
  { id: 'side-project', label: 'Side Project', emoji: '🌙', desc: 'Sporadic bursts, evenings & weekends' },
  { id: 'daily-grind', label: 'Daily Grind', emoji: '⚙️', desc: 'Consistent commits every day' },
  { id: 'weekend-warrior', label: 'Weekend Warrior', emoji: '🏄', desc: 'Most work on weekends' },
  { id: 'crunch-mode', label: 'Crunch Mode', emoji: '🔥', desc: 'Deadline-driven, late nights' },
  { id: 'casual', label: 'Casual', emoji: '☕', desc: 'Relaxed, occasional commits' },
]

export const STEPS = [
  { n: 1, label: 'Identity' },
  { n: 2, label: 'Upload' },
  { n: 3, label: 'Timeline' },
  { n: 4, label: 'Style' },
  { n: 5, label: 'Generate' },
]

export function WizardProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<WizardStep>(1)
  const [stage, setStage] = useState<Stage>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const [authors, setAuthors] = useState<Author[]>([{ name: '', email: '', weight: 100, timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'UTC' } })() }])
  const [githubToken, setGithubToken] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [fileCount, setFileCount] = useState(0)

  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return toDateInputValue(d)
  })
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()))
  const [pattern, setPattern] = useState<PatternName>('daily-grind')
  const [weekdaysOnly, setWeekdaysOnly] = useState(false)
  const [totalCommits, setTotalCommits] = useState<number | null>(null)
  const [timezone, setTimezone] = useState<string>(() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone } catch { return 'UTC' } })
  const [toggledOffDates, setToggledOffDates] = useState<Record<string, boolean>>({})

  const [authorStyle, setAuthorStyle] = useState<AuthorStyle>('descriptive')
  const [branchName, setBranchName] = useState('main')
  const [addMergeCommits, setAddMergeCommits] = useState(true)
  const [excludeFolders, setExcludeFolders] = useState('node_modules,dist,build,.next')
  const [injectPRMerges, setInjectPRMerges] = useState(false)
  const [useAI, setUseAI] = useState(false)
  const [fileTypeDensity, setFileTypeDensity] = useState<Record<string, number>>({})

  const [result, setResult] = useState<GenerateResult | null>(null)
  const [visibleCommits, setVisibleCommits] = useState<CommitEntry[]>([])
  const [progress, setProgress] = useState(0)
  const [progressMsg, setProgressMsg] = useState('')

  const uploadFile = async () => {
    if (!file) return
    setStage('uploading')
    try {
      const fd = new FormData()
      fd.append('file', file)
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

  const value: WizardState = {
    step, setStep,
    stage, setStage,
    errorMsg, setErrorMsg,
    authors, setAuthors,
    githubToken, setGithubToken,
    file, setFile,
    sessionId, setSessionId,
    fileCount, setFileCount,
    startDate, setStartDate,
    endDate, setEndDate,
    pattern, setPattern,
    weekdaysOnly, setWeekdaysOnly,
    totalCommits, setTotalCommits,
    timezone, setTimezone,
    toggledOffDates, setToggledOffDates,
    authorStyle, setAuthorStyle,
    branchName, setBranchName,
    addMergeCommits, setAddMergeCommits,
    excludeFolders, setExcludeFolders,
    injectPRMerges, setInjectPRMerges,
    useAI, setUseAI,
    fileTypeDensity, setFileTypeDensity,
    result, setResult,
    visibleCommits, setVisibleCommits,
    progress, setProgress,
    progressMsg, setProgressMsg,
    uploadFile
  }

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
}

export function useWizard() {
  const context = useContext(WizardContext)
  if (context === undefined) {
    throw new Error('useWizard must be used within a WizardProvider')
  }
  return context
}
