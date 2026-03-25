'use client'

import { useSession } from "next-auth/react"
import { useWizard, PATTERNS, PatternName, toDateInputValue } from "./WizardContext"

export function StepTimeline() {
  const { data: session } = useSession() as any
  const isPro = !!session?.user?.isPro
  const { startDate, setStartDate, endDate, setEndDate, pattern, setPattern, weekdaysOnly, setWeekdaysOnly, fileCount } = useWizard()

  const dayCount = Math.max(0, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Configure the timeline</h2>
        <p className="text-sm text-white/40">Set the date range and activity pattern for your commit history.</p>
      </div>

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

      <div className="flex flex-col gap-2 p-3 rounded-xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-white/40">{dayCount} days · ~{fileCount} commits total</span>
          <span className="font-mono text-xs text-brand-green">{fileCount > 0 ? `≈${Math.ceil(fileCount / Math.max(dayCount, 1))} commits/day` : ''}</span>
        </div>
        {!isPro && (
          <div className="mt-1 pt-2 border-t border-white/5">
            <div className="flex justify-between font-mono text-xs mb-1.5">
              <span className="text-white/40">Free Quota Used</span>
              <span className={(session?.user?.freeCommitsUsed + fileCount) > 100 ? "text-brand-red font-bold" : "text-white/70"}>
                {(session?.user?.freeCommitsUsed || 0) + fileCount} / 100 commits
              </span>
            </div>
            <div className="w-full h-1.5 bg-black/50 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${(session?.user?.freeCommitsUsed + fileCount) > 100 ? 'bg-brand-red' : 'bg-[#00ff87]'}`} 
                style={{ width: `${Math.min((( (session?.user?.freeCommitsUsed || 0) + fileCount) / 100) * 100, 100)}%` }} 
              />
            </div>
            {(session?.user?.freeCommitsUsed + fileCount) > 100 && (
               <p className="font-mono text-[10px] text-brand-red mt-1.5">Total lifetime limit reached! Upgrade to Pro for unlimited commits.</p>
            )}
          </div>
        )}
      </div>

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

      <p className="font-mono text-[10px] text-white/25 mt-1">Working Zone is configured per-author in the Identity step.</p>
    </div>
  )
}
