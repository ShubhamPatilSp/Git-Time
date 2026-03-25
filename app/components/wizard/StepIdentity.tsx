'use client'

import { useSession, signOut } from "next-auth/react"
import { useWizard, TIMEZONE_OPTIONS } from "./WizardContext"

export function StepIdentity({ setShowUpgradeModal }: { setShowUpgradeModal: (v: boolean) => void }) {
  const { authors, setAuthors } = useWizard()
  const { data: session } = useSession()
  const isPro = !!(session?.user as any)?.isPro

  const ProfileVibePreview = () => {
    const weeks = 7
    const daysPerWeek = 7
    const grid: number[][] = Array.from({ length: weeks }, () =>
      Array.from({ length: daysPerWeek }, () => Math.random() < 0.5 ? Math.floor(Math.random() * 4) : 0)
    )
    const colors = ['bg-white/5', 'bg-brand-green/30', 'bg-brand-green/55', 'bg-brand-green/85', 'bg-brand-green']
    return (
      <div className="absolute bottom-full left-0 mb-2 z-50 p-3 rounded-xl border border-brand-green/20 bg-[#0a0a0f]/90 backdrop-blur-md shadow-2xl shadow-black/50 pointer-events-none">
        <p className="font-mono text-[8px] text-white/30 uppercase tracking-widest mb-2">Profile Vibe Preview</p>
        <div className="flex gap-0.5">
          {grid.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((val, di) => (
                <div key={di} className={`w-2.5 h-2.5 rounded-sm transition-colors ${colors[Math.min(val, 4)]}`} />
              ))}
            </div>
          ))}
        </div>
        <p className="font-mono text-[8px] text-white/20 mt-2 italic">Based on your settings</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Authenticated Account</h2>
        <p className="text-sm text-white/40">You are securely signed in via GitHub. Contributions will be mapped securely.</p>
      </div>

      {session?.user && (
        <div className="relative group">
          <div className="flex items-center gap-4 p-4 rounded-xl border border-brand-green/30 bg-brand-green/5 cursor-pointer">
            {session.user.image && <img src={session.user.image} alt="avatar" className="w-12 h-12 rounded-full border border-brand-green/50" />}
            <div className="flex-1 min-w-0">
              <p className="font-mono text-sm font-semibold text-brand-green truncate">{session.user.name || 'Developer'}</p>
              <p className="font-mono text-xs text-white/50 truncate">{session.user.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[8px] text-white/20 uppercase tracking-widest group-hover:text-white/40 transition-colors">hover for vibe</span>
              <button onClick={() => signOut()} className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono text-white/40 hover:bg-white/10 transition-colors flex-shrink-0">Sign Out</button>
            </div>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
            <ProfileVibePreview />
          </div>
        </div>
      )}

      <div className="space-y-3">
        {authors.map((author, i) => (
          <div key={i} className={`p-4 rounded-xl border space-y-3 transition-all ${i === 0 ? 'border-white/10 bg-white/5' : 'border-brand-cyan/20 bg-brand-cyan/5'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-white/40 uppercase tracking-widest">
                  {i === 0 ? 'Primary Identity' : `Co-author ${i}`}
                </span>
                {i > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-brand-cyan/10 text-brand-cyan text-[8px] font-bold uppercase tracking-widest border border-brand-cyan/25">PRO</span>
                )}
              </div>
              {i > 0 && (
                <button onClick={() => setAuthors(prev => prev.filter((_, idx) => idx !== i))}
                  className="font-mono text-xs text-red-400/60 hover:text-red-400 transition-colors">remove</button>
              )}
            </div>

            {i > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs text-white/30 mb-1.5">Name</label>
                  <input type="text" value={author.name} placeholder="Alex Rivera"
                    onChange={e => setAuthors(prev => prev.map((a, idx) => idx === i ? { ...a, name: e.target.value } : a))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 font-mono focus:outline-none focus:border-brand-cyan/50 transition-colors" />
                </div>
                <div>
                  <label className="block font-mono text-xs text-white/30 mb-1.5">Email</label>
                  <input type="email" value={author.email} placeholder="alex@dev.io"
                    onChange={e => setAuthors(prev => prev.map((a, idx) => idx === i ? { ...a, email: e.target.value } : a))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 font-mono focus:outline-none focus:border-brand-cyan/50 transition-colors" />
                </div>
              </div>
            )}

            <div>
              <label className="block font-mono text-xs text-white/30 mb-1.5">
                {i === 0 ? '🌍 Your Working Zone' : '🌍 Working Zone'}
              </label>
              <select value={author.timezone || 'UTC'}
                onChange={e => setAuthors(prev => prev.map((a, idx) => idx === i ? { ...a, timezone: e.target.value } : a))}
                style={{ backgroundColor: '#0d0d14', color: 'white' }}
                className="w-full border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-brand-green/50 transition-colors appearance-none cursor-pointer">
                {TIMEZONE_OPTIONS.map(tz => (
                  <option key={tz.value} value={tz.value} style={{ backgroundColor: '#0d0d14', color: 'white' }}>{tz.label}</option>
                ))}
              </select>
              <p className="font-mono text-[10px] text-white/25 mt-1">Commits cluster 9AM–7PM in this timezone.</p>
            </div>

            {authors.length > 1 && (
              <div>
                <label className="block font-mono text-xs text-white/30 mb-1.5">Commit share: <span className="text-white/60">{author.weight}%</span></label>
                <input type="range" min="10" max="90" value={author.weight}
                  onChange={e => setAuthors(prev => prev.map((a, idx) => idx === i ? { ...a, weight: Number(e.target.value) } : a))}
                  className="w-full accent-brand-cyan" />
              </div>
            )}
          </div>
        ))}

        {authors.length < 3 && (
          <button onClick={() => {
            if (!isPro) { setShowUpgradeModal(true); return }
            setAuthors(prev => [...prev, { name: '', email: '', weight: 30, timezone: 'America/New_York' }])
          }}
            className={`w-full py-3.5 rounded-full font-mono text-sm font-bold transition-all shadow-lg ${
              isPro
                ? 'bg-gradient-to-r from-[#00ff87] to-[#00d4ff] text-black hover:opacity-90'
                : 'bg-gradient-to-r from-[#00e5a0] to-[#00c4f0] text-black hover:opacity-90'
            }`}>
            {isPro ? (
              <span className="flex items-center justify-center gap-2">
                <span>+</span> Add Co-Author
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                🔒 Add Co-Author <span className="opacity-70">PRO</span>
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
