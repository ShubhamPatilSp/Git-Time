'use client'

import { useState } from 'react'
import { useSession } from "next-auth/react"
import { useWizard } from './WizardContext'

export function StepGenerate({ setShowUpgradeModal }: { setShowUpgradeModal: (v: boolean) => void }) {
  const { session } = useSession() as any
  const {
    stage, setStage, result, setResult, visibleCommits, setVisibleCommits,
    progress, setProgress, progressMsg, setProgressMsg, setErrorMsg,
    sessionId, startDate, endDate, authors, pattern, totalCommits, branchName,
    weekdaysOnly, timezone, toggledOffDates, authorStyle, addMergeCommits,
    injectPRMerges, excludeFolders, useAI, fileTypeDensity, fileCount, setStep, githubToken
  } = useWizard()
  
  const [pushingToGithub, setPushingToGithub] = useState(false)
  const [repoName, setRepoName] = useState(session?.user?.name ? 'my-project' : '')
  const [isPrivateRepo, setIsPrivateRepo] = useState(false)
  const [pushResult, setPushResult] = useState<{ repoUrl: string } | null>(null)

  const dayCount = Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))

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
          timezone,
          toggledOffDates: Object.keys(toggledOffDates).filter(k => toggledOffDates[k]),
          authorStyle,
          addMergeCommits,
          injectPRMerges,
          excludeFolders: excludeFolders.split(',').map(s => s.trim()).filter(Boolean),
          useAI,
          fileTypeDensity: Object.keys(fileTypeDensity).length > 0 ? fileTypeDensity : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        const error = new Error(data.error) as any
        error.code = data.code
        throw error
      }

      const jobId = data.jobId
      pollStatus(jobId)

    } catch (err: unknown) {
      if (err instanceof Error && (err as any).code === 'PAYMENT_REQUIRED') {
        setShowUpgradeModal(true)
        setStage('idle')
        return
      }
      setErrorMsg(err instanceof Error ? err.message : 'Generation failed')
      setStage('error')
    }
  }

  const pollStatus = async (jobId: string) => {
    try {
      const res = await fetch(`/api/status?jobId=${jobId}`)
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error)
        
      if (data.status === 'failed') {
        throw new Error(data.error || 'Job failed')
      }

      setProgress(data.progress || 0)
      setProgressMsg(data.message || 'Processing...')

      if (data.status === 'completed') {
        setResult(data.result)
        setStage('done')
        setProgress(100)
        setProgressMsg('Complete!')

        data.result.commits?.forEach((commit: any, i: number) => {
          setTimeout(() => setVisibleCommits(prev => [...prev, commit]), i * 40)
        })
        return
      }

      // Continue polling
      setTimeout(() => pollStatus(jobId), 1500)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Status check failed')
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

  return (
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

          <a href={result.downloadUrl} download className="btn-download flex items-center justify-center gap-2 w-full rounded-xl py-3.5 text-sm font-semibold">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            Download Repository ZIP
          </a>

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

          <button onClick={() => { setStage('idle'); setResult(null); setVisibleCommits([]) }}
            className="w-full py-2.5 font-mono text-xs text-white/25 hover:text-white/50 transition-colors">
            ↺ regenerate with different settings
          </button>
        </div>
      )}
    </div>
  )
}
