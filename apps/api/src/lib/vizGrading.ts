const DEFAULT_EPSILON = 0.05

/**
 * Compares a student's current visualization state against the stored target.
 * Numeric values are compared with a tolerance (default ±0.05).
 * Keys starting with '_' are metadata and are skipped.
 *
 * @param target  - The stored correct state (from Exercise.targetState)
 * @param actual  - The state submitted by the student
 * @param epsilon - Default numeric tolerance when no per-key override is set
 */
export function compareVizStates(
  target: Record<string, unknown>,
  actual: Record<string, unknown>,
  epsilon = DEFAULT_EPSILON,
): boolean {
  const toleranceOverrides = (target._tolerance ?? {}) as Record<string, number>

  return Object.entries(target).every(([key, expected]) => {
    if (key.startsWith('_')) return true   // skip metadata keys

    const actualVal = actual[key]

    if (typeof expected === 'number') {
      const tol = typeof toleranceOverrides[key] === 'number' ? toleranceOverrides[key] : epsilon
      return typeof actualVal === 'number' && Math.abs(actualVal - expected) <= tol
    }

    return actualVal === expected
  })
}

export type GradingResult = 'correct' | 'almost' | 'incorrect'

/**
 * Three-tier grading for interactive visualization exercises.
 * - 'correct':   all values within epsilon (or exact for non-numeric)
 * - 'almost':    all values within 2 × epsilon
 * - 'incorrect': at least one value outside 2 × epsilon
 */
export function gradeVizState(
  target: Record<string, unknown>,
  actual: Record<string, unknown>,
  epsilon = DEFAULT_EPSILON,
): GradingResult {
  const toleranceOverrides = (target._tolerance ?? {}) as Record<string, number>
  let withinStrict = true
  let withinLoose  = true

  for (const [key, expected] of Object.entries(target)) {
    if (key.startsWith('_')) continue

    const actualVal = actual[key]

    if (typeof expected === 'number') {
      const tol = typeof toleranceOverrides[key] === 'number' ? toleranceOverrides[key] : epsilon
      if (typeof actualVal !== 'number') { withinStrict = false; withinLoose = false; continue }
      const diff = Math.abs(actualVal - expected)
      if (diff > tol)      withinStrict = false
      if (diff > tol * 2)  withinLoose  = false
    } else {
      if (actualVal !== expected) { withinStrict = false; withinLoose = false }
    }
  }

  if (withinStrict) return 'correct'
  if (withinLoose)  return 'almost'
  return 'incorrect'
}
