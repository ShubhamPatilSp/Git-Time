'use client'
import { PatternName } from './WizardContext'

export function HeatmapPreview({ startDate, endDate, pattern, weekdaysOnly, fileCount, toggledOffDates, onToggleDate, timezone, showMilestones }: {
  startDate: string; endDate: string; pattern: PatternName; weekdaysOnly: boolean; fileCount: number;
  toggledOffDates?: Record<string, boolean>; onToggleDate?: (dateStr: string) => void;
  timezone?: string; showMilestones?: boolean;
}) {
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
    'custom': [1, 1, 1, 1, 1, 1, 1], // Flat distribution fallback
  }

  const weights = DENSITY[pattern] || DENSITY['daily-grind']
  const cells: { intensity: number; dateStr: string; isActive: boolean; isMilestone: boolean }[] = []

  const randomMilestone = (i: number) => showMilestones && (i % 14 === 3 || i % 25 === 12)

  for (let i = 0; i < Math.min(total, 105); i++) {
    const d = new Date(start); d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const dow = d.getDay()
    
    let w = weights[dow]
    if (weekdaysOnly && (dow === 0 || dow === 6)) w = 0
    
    const isActive = !toggledOffDates?.[dateStr]
    cells.push({ 
      intensity: w, 
      dateStr, 
      isActive,
      isMilestone: Boolean(randomMilestone(i) && w > 0 && isActive)
    })
  }

  const max = Math.max(...cells.map(c => c.intensity), 1)

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-3">
        {cells.map((c, i) => {
          const intensity = c.isActive ? c.intensity / max : 0
          const color = intensity === 0 ? 'rgba(255,255,255,0.04)' :
            intensity < 0.3 ? 'rgba(0,255,135,0.15)' :
              intensity < 0.6 ? 'rgba(0,255,135,0.35)' :
                intensity < 0.85 ? 'rgba(0,255,135,0.6)' : '#00ff87'
                
          return (
            <div 
              key={i} 
              title={`${c.dateStr}${!c.isActive ? ' (Toggled Off)' : ''}${c.isMilestone ? ' - PR Merge Expected' : ''}`}
              onClick={() => onToggleDate && onToggleDate(c.dateStr)}
              className={`rounded-sm relative ${onToggleDate ? 'cursor-pointer hover:ring-1 hover:ring-white/50 transition-all' : ''} ${!c.isActive ? 'opacity-20' : ''}`} 
              style={{ width: '10px', height: '10px', background: color }} 
            >
              {c.isMilestone && (
                <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-[#b026ff] rounded-full shadow-[0_0_4px_#b026ff]"></div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-4 p-2 bg-white/5 rounded duration-300">
        <span className="font-mono text-[10px] text-white/40">{timezone !== 'UTC' ? `🕒 Zone: ${timezone}` : '🕒 Zone: Random/UTC'}</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-subtle">less</span>
          <div className="flex gap-1">
            {['rgba(255,255,255,0.04)', 'rgba(0,255,135,0.15)', 'rgba(0,255,135,0.35)', 'rgba(0,255,135,0.6)', '#00ff87'].map((c, i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} />
            ))}
          </div>
          <span className="font-mono text-xs text-subtle">more</span>
        </div>
      </div>
    </div>
  )
}
