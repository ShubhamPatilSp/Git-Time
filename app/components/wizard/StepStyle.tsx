'use client'

import { useState } from 'react'
import { useSession } from "next-auth/react"
import { useWizard, AUTHOR_STYLES, AuthorStyle } from './WizardContext'

export function StepStyle({ setShowUpgradeModal }: { setShowUpgradeModal: (v: boolean) => void }) {
  const { data: session } = useSession() as any
  const isPro = !!session?.user?.isPro
  const { 
    authors, weekdaysOnly, toggledOffDates, 
    authorStyle, setAuthorStyle, 
    branchName, setBranchName, 
    addMergeCommits, setAddMergeCommits, 
    excludeFolders, setExcludeFolders, 
    injectPRMerges, setInjectPRMerges, 
    useAI, setUseAI, 
    fileTypeDensity, setFileTypeDensity 
  } = useWizard()
  // Derive initial preset from persisted fileTypeDensity to stay in sync after navigation
  const [densityPreset, setDensityPreset] = useState<string>(() => {
    const presets = [
      { id: 'fullstack', map: { ts: 50, tsx: 30, css: 10, json: 10 } },
      { id: 'backend', map: { ts: 60, js: 20, json: 15, md: 5 } },
      { id: 'frontend', map: { tsx: 50, css: 30, ts: 20 } },
    ]
    const keys = Object.keys(fileTypeDensity)
    if (keys.length === 0) return 'default'
    for (const p of presets) {
      const pKeys = Object.keys(p.map)
      if (pKeys.length === keys.length && pKeys.every(k => (p.map as any)[k] === fileTypeDensity[k])) return p.id
    }
    return 'custom'
  })

  const calculateRealismScore = () => {
    let score = 20
    if (authors.some(a => a.timezone && a.timezone !== 'UTC')) score += 15
    if (authors.length > 1) score += 10
    if (weekdaysOnly) score += 10
    if (Object.keys(toggledOffDates).length > 0) score += 10
    if (authorStyle === 'conventional') score += 15
    if (addMergeCommits) score += 10
    if (injectPRMerges) score += 10
    if (useAI) score += 10
    return Math.min(score, 100)
  }

  const realismScore = calculateRealismScore()

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Commit style & settings</h2>
          <p className="text-sm text-white/40">Fine-tune how commits look and feel.</p>
        </div>
        
        <div className="flex flex-col items-center group cursor-help relative -mt-2" title="Realism Meter: Increases as you add human-like behaviors.">
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 transform -rotate-90">
              <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="2.5" fill="transparent" className="text-white/5" />
              <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="2.5" fill="transparent" 
                strokeDasharray={2 * Math.PI * 24} 
                strokeDashoffset={2 * Math.PI * 24 * (1 - realismScore / 100)} 
                className={`transition-all duration-1000 ease-out ${realismScore > 80 ? 'text-brand-green shadow-[0_0_10px_#00ff87]' : realismScore > 50 ? 'text-brand-cyan' : 'text-white/30'}`} 
                strokeLinecap="round" 
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-xs font-mono font-bold text-white tracking-tighter" style={{ textShadow: realismScore > 80 ? '0 0 8px rgba(0,255,135,0.8)' : 'none' }}>{realismScore}%</span>
            </div>
            {realismScore === 100 && (
              <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-brand-green rounded-full border-2 border-[#0a0a0f] animate-pulse"></div>
            )}
          </div>
          <span className="font-mono text-[8px] text-white/40 uppercase tracking-widest mt-1 opacity-80 group-hover:text-brand-green group-hover:opacity-100 transition-all">Realism</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div>
            <label className="block font-mono text-xs text-white/40 uppercase tracking-widest mb-3">Commit Message Style</label>
            <div className="space-y-2">
              {AUTHOR_STYLES.map(s => (
                <button key={s.id} onClick={() => setAuthorStyle(s.id as AuthorStyle)}
                  className={`w-full p-3.5 rounded-xl text-left transition-all border ${authorStyle === s.id ? 'border-brand-cyan/40 bg-brand-cyan/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`font-mono text-xs font-semibold ${authorStyle === s.id ? 'text-brand-cyan' : 'text-white/60'}`}>{s.label}</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${s.badgeClass}`}>
                      {s.badge}
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-white/30 italic">"{s.example}"</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block font-mono text-xs text-white/40 uppercase tracking-widest mb-2">Branch Name</label>
              <input type="text" value={branchName} onChange={e => setBranchName(e.target.value)}
                placeholder="main"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-brand-green/50 transition-colors" />
            </div>

            <div>
              <label className="block font-mono text-xs text-white/40 uppercase tracking-widest mb-2">Additional Exclude Folders</label>
              <input type="text" value={excludeFolders} onChange={e => setExcludeFolders(e.target.value)}
                placeholder="folder1, folder2, ..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-brand-green/50 transition-colors" />
              <p className="font-mono text-[10px] text-white/30 mt-1.5">comma-separated folder names to skip</p>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block font-mono text-xs text-white/40 uppercase tracking-widest mb-3">Professional Workflow</label>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3.5 rounded-xl border border-white/5 bg-white/5 cursor-pointer hover:border-white/10 transition-colors">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="font-mono text-sm text-white/70 truncate">Merge Commits</p>
                  <p className="font-mono text-[10px] text-white/30 mt-0.5 truncate">Simulate regular merge-back workflow</p>
                </div>
                <div className={`relative rounded-full transition-colors flex-shrink-0`}
                  style={{ width: '40px', height: '22px', background: addMergeCommits ? '#00ff87' : 'rgba(255,255,255,0.1)' }}
                  onClick={() => setAddMergeCommits(p => !p)}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform`}
                    style={{ margin: '1px', transform: addMergeCommits ? 'translateX(18px)' : 'translateX(0)' }} />
                </div>
              </label>

              <label className={`flex items-start justify-between p-3.5 rounded-xl border cursor-pointer transition-colors ${!isPro ? 'opacity-60 border-white/5 bg-white/5' : 'border-brand-purple/20 bg-brand-purple/5 hover:border-brand-purple/30'}`}
                onClick={() => isPro ? setInjectPRMerges(p => !p) : setShowUpgradeModal(true)}>
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`font-mono text-sm font-semibold truncate ${isPro ? 'text-[#b026ff]' : 'text-white/70'}`}>Fake PRs & Branches</p>
                    {!isPro && <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/40 text-[8px] font-bold uppercase tracking-widest border border-white/10 flex-shrink-0">🔒 PRO</span>}
                  </div>
                  <p className="font-mono text-[10px] text-white/40 italic truncate">"Merge PR #12 from feature/auth"</p>
                </div>
                <div className={`relative rounded-full transition-colors shadow flex-shrink-0 mt-1 ${injectPRMerges && isPro ? 'shadow-brand-purple/50' : ''}`}
                  style={{ width: '40px', height: '22px', background: injectPRMerges && isPro ? '#b026ff' : 'rgba(255,255,255,0.1)' }}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform`}
                    style={{ margin: '1px', transform: injectPRMerges && isPro ? 'translateX(18px)' : 'translateX(0)' }} />
                </div>
              </label>

              <label className={`flex items-start justify-between p-3.5 rounded-xl border cursor-pointer transition-colors ${!isPro ? 'opacity-60 border-white/5 bg-white/5' : 'border-brand-cyan/20 bg-brand-cyan/5 hover:border-brand-cyan/30'}`}
                onClick={() => isPro ? setUseAI(p => !p) : setShowUpgradeModal(true)}>
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`font-mono text-sm font-semibold truncate ${isPro ? 'text-transparent bg-clip-text' : 'text-white/70'}`} style={isPro ? { backgroundImage: 'linear-gradient(90deg, #00ff87, #00d4ff)' } : {}}>AI Commit Messages</p>
                    {isPro ? (
                      <span className="px-1.5 py-0.5 rounded bg-[#00d4ff]/20 text-[#00d4ff] text-[8px] font-bold uppercase tracking-widest border border-[#00d4ff]/30 animate-pulse flex-shrink-0">PREMIUM</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/40 text-[8px] font-bold uppercase tracking-widest border border-white/10 flex-shrink-0">🔒 PRO</span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-white/40 italic truncate">Highly realistic ChatGPT-generated messages</p>
                </div>
                <div className={`relative rounded-full transition-colors flex-shrink-0 mt-1 ${useAI && isPro ? 'shadow-[0_0_12px_rgba(0,212,255,0.4)]' : ''}`}
                  style={{ width: '40px', height: '22px', background: useAI && isPro ? 'linear-gradient(90deg, #00ff87, #00d4ff)' : 'rgba(255,255,255,0.1)' }}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform`}
                    style={{ margin: '1px', transform: useAI && isPro ? 'translateX(18px)' : 'translateX(0)' }} />
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className={`mt-2 pt-4 border-t border-white/5 ${!isPro ? 'opacity-60 cursor-pointer' : ''}`} 
        onClick={() => !isPro && setShowUpgradeModal(true)}>
        <div className={`space-y-3 ${!isPro ? 'pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2">
            <label className="block font-mono text-xs text-white/40 uppercase tracking-widest">Commit Target Density</label>
            {!isPro && <span className="text-xs bg-[#ffb347]/20 text-[#ffb347] border border-[#ffb347]/30 px-2 py-0.5 rounded-full font-mono">🔒 PRO</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {([
              { id: 'default', label: '⚖️ Balanced', map: {} as Record<string, number> },
              { id: 'fullstack', label: '🖥️ Full-Stack', map: { ts: 50, tsx: 30, css: 10, json: 10 } },
              { id: 'backend', label: '⚙️ Backend Heavy', map: { ts: 60, js: 20, json: 15, md: 5 } },
              { id: 'frontend', label: '🎨 Frontend Heavy', map: { tsx: 50, css: 30, ts: 20 } },
            ] as { id: string; label: string; map: Record<string, number> }[]).map(p => (
              <button key={p.id} onClick={() => { 
                  if (!isPro) {
                    setShowUpgradeModal(true);
                    return;
                  }
                  setDensityPreset(p.id); 
                  setFileTypeDensity(p.map);
                }}
                className={`p-2.5 rounded-xl text-left border transition-all text-xs font-mono ${densityPreset === p.id ? 'border-brand-amber/40 bg-brand-amber/10 text-brand-amber' : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
                  }`}>{p.label}</button>
            ))}
          </div>
          {densityPreset !== 'default' && Object.entries(fileTypeDensity).map(([ext, weight]) => (
            <div key={ext} className="flex items-center gap-3 mb-2">
              <span className="font-mono text-xs text-white/50 w-10">.{ext}</span>
              <input type="range" min={5} max={90} value={weight}
                disabled={!isPro}
                onChange={e => {
                  if (!isPro) return;
                  setFileTypeDensity(prev => ({ ...prev, [ext]: Number(e.target.value) }))
                }}
                className={`flex-1 accent-amber-400 h-1.5 rounded-full ${!isPro ? 'opacity-50 cursor-not-allowed' : ''}`} />
              <span className="font-mono text-xs text-brand-amber w-8 text-right">{weight}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
