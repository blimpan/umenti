import { applyDecay } from './decay'

/**
 * Computes the decay-weighted average progress score for one student across a
 * set of concept progress rows. Returns null if the student has no rows (i.e.
 * they have not started any concept in the course).
 */
export function computeProgress(
  rows: { score: number; lastActivityAt: Date }[]
): number | null {
  if (rows.length === 0) return null
  const scores = rows.map(r => applyDecay(r.score, r.lastActivityAt))
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  return Math.min(100, Math.max(0, avg))
}

/**
 * Returns the most recent ModuleSession updatedAt as an ISO string, or null if
 * the student has no sessions (i.e. they have never opened a module).
 */
export function latestSession(
  sessions: { updatedAt: Date }[]
): string | null {
  if (sessions.length === 0) return null
  return sessions
    .reduce((latest, s) => (s.updatedAt > latest.updatedAt ? s : latest))
    .updatedAt.toISOString()
}

/**
 * Chooses the time bucketing granularity for the analytics chart based on the
 * span between the earliest and latest exercise attempt.
 *
 * Thresholds:
 *   span < 48 h  → 'hour'
 *   span < 720 h → 'day'  (30 days)
 *   otherwise    → 'week'
 */
export function pickGranularity(
  minDate: Date | null,
  maxDate: Date | null
): 'hour' | 'day' | 'week' {
  if (!minDate || !maxDate) return 'day'
  const spanHours = (maxDate.getTime() - minDate.getTime()) / 3_600_000
  if (spanHours < 48) return 'hour'
  if (spanHours < 720) return 'day'
  return 'week'
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Returns true when a student is at risk of falling behind.
 * Criteria: progress is defined but below 50, AND the student has not been
 * active in the last 7 days (or has never been active despite having progress).
 */
export function computeAtRisk(
  progress: number | null,
  lastActiveAt: string | null
): boolean {
  if (progress === null || progress >= 50) return false
  if (!lastActiveAt) return true
  return Date.now() - new Date(lastActiveAt).getTime() > SEVEN_DAYS_MS
}
