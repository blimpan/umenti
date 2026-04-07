import { describe, it, expect } from 'vitest'
import { compareVizStates, gradeVizState } from './vizGrading'

describe('compareVizStates', () => {
  it('returns true when numeric values match within default epsilon', () => {
    expect(compareVizStates({ slope: 2, intercept: -3 }, { slope: 2.03, intercept: -3.01 })).toBe(true)
  })

  it('returns false when a numeric value is outside epsilon', () => {
    expect(compareVizStates({ slope: 2 }, { slope: 2.1 })).toBe(false)
  })

  it('returns true for exact string match', () => {
    expect(compareVizStates({ shape: 'circle' }, { shape: 'circle' })).toBe(true)
  })

  it('returns false for string mismatch', () => {
    expect(compareVizStates({ shape: 'circle' }, { shape: 'square' })).toBe(false)
  })

  it('returns true when all keys match with per-key tolerance override', () => {
    expect(compareVizStates(
      { slope: 2, _tolerance: { slope: 0.2 } },
      { slope: 2.15 }
    )).toBe(true)
  })

  it('returns false when actual is missing a required key', () => {
    expect(compareVizStates({ slope: 2, intercept: -3 }, { slope: 2 })).toBe(false)
  })

  it('returns true for empty target (trivially satisfied)', () => {
    expect(compareVizStates({}, { anything: 'here' })).toBe(true)
  })
})

describe('gradeVizState', () => {
  it('returns correct when all numeric values exactly match', () => {
    expect(gradeVizState({ slope: 2, intercept: -3 }, { slope: 2, intercept: -3 })).toBe('correct')
  })

  it('returns correct when values are within epsilon', () => {
    // |2.04 - 2| = 0.04 ≤ 0.05
    expect(gradeVizState({ slope: 2 }, { slope: 2.04 })).toBe('correct')
  })

  it('returns almost when values are within 2× epsilon but outside epsilon', () => {
    // |2.08 - 2| = 0.08 > 0.05 but ≤ 0.10
    expect(gradeVizState({ slope: 2 }, { slope: 2.08 })).toBe('almost')
  })

  it('returns incorrect when any value exceeds 2× epsilon', () => {
    // |2.15 - 2| = 0.15 > 0.10
    expect(gradeVizState({ slope: 2 }, { slope: 2.15 })).toBe('incorrect')
  })

  it('handles zero target value without crashing', () => {
    // absolute diff: |0.04 - 0| = 0.04 ≤ 0.05 → correct
    expect(gradeVizState({ intercept: 0 }, { intercept: 0.04 })).toBe('correct')
  })

  it('respects per-key _tolerance overrides', () => {
    const target = { angle: 45, _tolerance: { angle: 2 } }
    expect(gradeVizState(target, { angle: 46.5 })).toBe('correct')   // within 2
    expect(gradeVizState(target, { angle: 48.5 })).toBe('almost')    // within 4
    expect(gradeVizState(target, { angle: 50 })).toBe('incorrect')   // outside 4
  })

  it('returns incorrect when a numeric key is missing from submitted', () => {
    expect(gradeVizState({ slope: 2, intercept: -3 }, { slope: 2 })).toBe('incorrect')
  })

  it('matches non-numeric values exactly', () => {
    expect(gradeVizState({ mode: 'linear' }, { mode: 'linear' })).toBe('correct')
    expect(gradeVizState({ mode: 'linear' }, { mode: 'quadratic' })).toBe('incorrect')
  })

  it('skips metadata keys starting with underscore', () => {
    expect(gradeVizState({ slope: 2, _meta: 'info' }, { slope: 2 })).toBe('correct')
  })
})
