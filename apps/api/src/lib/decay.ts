// SCORE_DECAY_UNIT controls the time unit for the 10%-per-unit decay formula.
// Set to 'minutes' in development to observe decay quickly; leave unset (defaults
// to 'weeks') in production.
export const DECAY_UNIT_MS = process.env.SCORE_DECAY_UNIT === 'minutes'
  ? 60 * 1000
  : 7 * 24 * 60 * 60 * 1000

/**
 * Applies time-based decay to a raw score.
 * effectiveScore = score × (0.9 ^ unitsSinceLastActivity)
 * Returned value is rounded to 1 decimal place.
 */
export function applyDecay(score: number, lastActivityAt: Date): number {
  const unitsSince = (Date.now() - lastActivityAt.getTime()) / DECAY_UNIT_MS
  return Math.round(score * Math.pow(0.9, unitsSince) * 10) / 10
}
