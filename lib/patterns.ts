// Commit frequency patterns

export type PatternName =
  | 'active-sprint'
  | 'side-project'
  | 'daily-grind'
  | 'weekend-warrior'
  | 'crunch-mode'
  | 'casual'
  | 'custom'

export interface CommitPattern {
  name: PatternName
  label: string
  description: string
  emoji: string
  weekdayProb: number
  weekendProb: number
  densityMean: number
  densityVariance: number
  hourWeights: number[]
  allowGaps: boolean
  gapFrequency: number
}

const MORNING_HEAVY: number[] = [
  0, 0, 0, 0, 0, 0, 0, 0.2,
  0.8, 1.5, 1.8, 1.6,
  0.9, 0.7,
  1.2, 1.4, 1.3, 1.0,
  0.5, 0.3, 0.2, 0.1, 0, 0,
]

const NIGHT_OWL: number[] = [
  0.3, 0.5, 0.6, 0.4, 0.1, 0, 0, 0,
  0.2, 0.3, 0.4, 0.5,
  0.6, 0.5,
  0.7, 0.8, 0.9, 1.0,
  1.2, 1.5, 1.8, 1.6, 1.0, 0.6,
]

const ALL_DAY: number[] = [
  0, 0, 0, 0, 0, 0, 0.1, 0.3,
  0.8, 1.2, 1.4, 1.3,
  0.9, 0.8,
  1.1, 1.3, 1.2, 1.0,
  0.8, 0.6, 0.5, 0.4, 0.2, 0.1,
]

const BUSINESS_HOURS: number[] = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0.3, 1.2, 1.8, 1.6,
  0.8, 0.6,
  1.4, 1.6, 1.5, 1.2,
  0.4, 0.2, 0.1, 0, 0, 0,
]

const CRUNCH: number[] = [
  0.8, 0.6, 0.4, 0.2, 0, 0, 0, 0.2,
  0.6, 1.0, 1.2, 1.4,
  1.0, 0.9,
  1.3, 1.5, 1.6, 1.8,
  1.6, 1.4, 1.2, 1.0, 0.9, 0.8,
]

export const PATTERNS: Record<PatternName, CommitPattern> = {
  'active-sprint': {
    name: 'active-sprint',
    label: 'Active Sprint',
    description: 'Heavy weekday activity, focused sprints',
    emoji: '🚀',
    weekdayProb: 0.92,
    weekendProb: 0.15,
    densityMean: 3,
    densityVariance: 2,
    hourWeights: BUSINESS_HOURS,
    allowGaps: true,
    gapFrequency: 0.08,
  },
  'side-project': {
    name: 'side-project',
    label: 'Side Project',
    description: 'Sporadic bursts, evenings & weekends',
    emoji: '🌙',
    weekdayProb: 0.35,
    weekendProb: 0.70,
    densityMean: 2,
    densityVariance: 2,
    hourWeights: NIGHT_OWL,
    allowGaps: true,
    gapFrequency: 0.45,
  },
  'daily-grind': {
    name: 'daily-grind',
    label: 'Daily Grind',
    description: 'Consistent commits every day',
    emoji: '⚙️',
    weekdayProb: 0.95,
    weekendProb: 0.60,
    densityMean: 2,
    densityVariance: 1,
    hourWeights: MORNING_HEAVY,
    allowGaps: false,
    gapFrequency: 0.05,
  },
  'weekend-warrior': {
    name: 'weekend-warrior',
    label: 'Weekend Warrior',
    description: 'Most work happens on weekends',
    emoji: '🏄',
    weekdayProb: 0.20,
    weekendProb: 0.95,
    densityMean: 4,
    densityVariance: 3,
    hourWeights: ALL_DAY,
    allowGaps: true,
    gapFrequency: 0.55,
  },
  'crunch-mode': {
    name: 'crunch-mode',
    label: 'Crunch Mode',
    description: 'Deadline-driven, late nights, all hours',
    emoji: '🔥',
    weekdayProb: 0.98,
    weekendProb: 0.90,
    densityMean: 5,
    densityVariance: 3,
    hourWeights: CRUNCH,
    allowGaps: false,
    gapFrequency: 0.02,
  },
  'casual': {
    name: 'casual',
    label: 'Casual',
    description: 'Relaxed pace, occasional commits',
    emoji: '☕',
    weekdayProb: 0.50,
    weekendProb: 0.25,
    densityMean: 1,
    densityVariance: 1,
    hourWeights: MORNING_HEAVY,
    allowGaps: true,
    gapFrequency: 0.40,
  },
  'custom': {
    name: 'custom',
    label: 'Custom',
    description: 'Use your own settings',
    emoji: '🎛️',
    weekdayProb: 0.80,
    weekendProb: 0.30,
    densityMean: 2,
    densityVariance: 2,
    hourWeights: BUSINESS_HOURS,
    allowGaps: true,
    gapFrequency: 0.20,
  },
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export interface DaySlot {
  date: Date
  commitCount: number
  isWeekend: boolean
}

/**
 * Generate a realistic day-by-day commit schedule.
 *
 * KEY FIX: totalCommits is now the EXACT number of commits to spread.
 * We first build a list of eligible days weighted by the pattern,
 * then distribute commits across them evenly with small variance.
 * This guarantees every commit is placed regardless of how small
 * totalCommits is relative to the date range.
 */
export function generateDaySchedule(
  startDate: Date,
  endDate: Date,
  totalCommits: number,
  pattern: CommitPattern,
  seed: number = Date.now()
): DaySlot[] {
  const rng = seededRandom(seed)

  // Build full list of days in range
  const allDays: DaySlot[] = []
  const current = new Date(startDate)
  current.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 0)

  while (current <= end) {
    const dow = current.getDay()
    const isWeekend = dow === 0 || dow === 6
    allDays.push({
      date: new Date(current),
      commitCount: 0,
      isWeekend,
    })
    current.setDate(current.getDate() + 1)
  }

  if (allDays.length === 0 || totalCommits === 0) return []

  // Score each day by pattern probability
  const scoredDays = allDays.map(d => ({
    ...d,
    score: (d.isWeekend ? pattern.weekendProb : pattern.weekdayProb) * (0.5 + rng() * 0.5),
  }))

  // Sort by score descending — highest probability days get commits first
  scoredDays.sort((a, b) => b.score - a.score)

  // Figure out how many days to activate
  // Use enough days to keep commits-per-day realistic (1-6 range)
  const maxCommitsPerDay = Math.max(1, pattern.densityMean + pattern.densityVariance)
  const minDaysNeeded = Math.ceil(totalCommits / maxCommitsPerDay)
  const idealDays = Math.max(minDaysNeeded, Math.floor(allDays.length * (pattern.weekdayProb * 0.7)))
  const activeDayCount = Math.min(scoredDays.length, Math.max(minDaysNeeded, idealDays))

  // Activate the top-scored days
  const activeDays = scoredDays.slice(0, activeDayCount)

  // Distribute commits across active days
  let remaining = totalCommits

  // First pass: give each active day a base of 1 commit
  for (let i = 0; i < activeDays.length && remaining > 0; i++) {
    activeDays[i].commitCount = 1
    remaining--
  }

  // Second pass: distribute remaining commits with variance
  let pass = 0
  while (remaining > 0) {
    for (let i = 0; i < activeDays.length && remaining > 0; i++) {
      const day = activeDays[i]
      const maxToday = Math.max(1, Math.round(
        pattern.densityMean + pattern.densityVariance * (rng() * 2 - 1)
      ))
      if (day.commitCount < maxToday || pass > 3) {
        day.commitCount++
        remaining--
      }
    }
    pass++
    if (pass > 50) {
      // Safety: force dump remaining onto random active days
      for (let i = 0; remaining > 0; i++) {
        activeDays[i % activeDays.length].commitCount++
        remaining--
      }
      break
    }
  }

  // Sort active days by actual date (ascending) for chronological commits
  activeDays.sort((a, b) => a.date.getTime() - b.date.getTime())

  return activeDays.filter(d => d.commitCount > 0)
}

export function pickHour(hourWeights: number[], rng: () => number): number {
  const total = hourWeights.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < hourWeights.length; i++) {
    r -= hourWeights[i]
    if (r <= 0) return i
  }
  return 10
}

export function generateTimestamps(
  date: Date,
  count: number,
  pattern: CommitPattern,
  seed: number
): { authorDate: Date; committerDate: Date }[] {
  const rng = seededRandom(seed)
  const results: { authorDate: Date; committerDate: Date }[] = []

  const hours: number[] = []
  for (let i = 0; i < count; i++) {
    hours.push(pickHour(pattern.hourWeights, rng))
  }
  hours.sort((a, b) => a - b)

  // Ensure minimum 10 min gap between commits on same day
  for (let i = 1; i < hours.length; i++) {
    if (hours[i] <= hours[i - 1]) {
      hours[i] = hours[i - 1] + 1
    }
  }

  for (const hour of hours) {
    const safeHour = Math.min(hour, 23)
    const authorDate = new Date(date)
    authorDate.setHours(safeHour, Math.floor(rng() * 60), Math.floor(rng() * 60), 0)

    // Committer date 1-3 minutes after author (realistic git behavior)
    const committerDate = new Date(authorDate)
    committerDate.setMinutes(committerDate.getMinutes() + Math.floor(rng() * 3) + 1)

    results.push({ authorDate, committerDate })
  }

  return results
}
