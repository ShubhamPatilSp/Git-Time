'use client'

import { useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useWizard } from './WizardContext'

export function StepUpload() {
  const { data: session } = useSession()
  const isPro = !!(session?.user as any)?.isPro
  const maxSizeMB = isPro ? 250 : 50
  const { file, setFile, sessionId, setSessionId, stage, uploadFile, setErrorMsg, fileCount } = useWizard()
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateAndSetFile = (f: File) => {
    if (!f.name.endsWith('.zip')) { setErrorMsg('Only .zip files accepted'); return }
    if (f.size > maxSizeMB * 1024 * 1024) { setErrorMsg(`Max ${maxSizeMB}MB for your plan.${!isPro ? ' Upgrade to Pro for 250MB!' : ''}`); return }
    setFile(f); setErrorMsg(''); setSessionId(null)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; 
    if (f) {
      if (!f.name.endsWith('.zip')) { setErrorMsg('Only .zip files accepted'); return }
      if (f.size > maxSizeMB * 1024 * 1024) { setErrorMsg(`Max ${maxSizeMB}MB for your plan.${!isPro ? ' Upgrade to Pro for 250MB!' : ''}`); return }
      setFile(f); setErrorMsg(''); setSessionId(null)
    }
  }, [setErrorMsg, setFile, setSessionId, maxSizeMB, isPro])

  return (
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
            <p className="font-mono text-xs text-muted mt-1">or click to browse · max {maxSizeMB}MB</p>
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

      <div className="p-3 rounded-xl border border-white/5 bg-white/5">
        <p className="font-mono text-xs text-white/25">
          Auto-excluded: <span className="text-white/40">node_modules, .git, dist, build, .next, *.lock, images, binaries</span>
        </p>
      </div>
    </div>
  )
}
