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
