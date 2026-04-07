import { describe, it, expect } from 'vitest'
import { computeProgress, latestSession, pickGranularity } from './analytics'
import { applyDecay } from './decay'

describe('computeProgress', () => {
  it('returns null when the student has no concept progress rows', () => {
    expect(computeProgress([])).toBeNull()
  })

  it('returns the average decay-applied score when rows exist', () => {
    const now = new Date()
    // Both rows have lastActivityAt = now, so negligible decay is applied.
    // Average of 80 and 60 = 70.
    const result = computeProgress([
      { score: 80, lastActivityAt: now },
      { score: 60, lastActivityAt: now },
    ])
    expect(result).toBeCloseTo(70, 1)
  })

  it('applies decay — result equals applyDecay applied to the single row', () => {
    const longAgo = new Date(Date.now() - 100 * 7 * 24 * 60 * 60 * 1000)
    const expected = applyDecay(100, longAgo)
    expect(computeProgress([{ score: 100, lastActivityAt: longAgo }])).toBeCloseTo(expected, 5)
  })
})

describe('latestSession', () => {
  it('returns null when the student has no sessions', () => {
    expect(latestSession([])).toBeNull()
  })

  it('returns the most recent updatedAt as an ISO string', () => {
    const older = new Date('2026-03-01T10:00:00.000Z')
    const newer = new Date('2026-04-01T10:00:00.000Z')
    expect(latestSession([{ updatedAt: older }, { updatedAt: newer }])).toBe(
      newer.toISOString()
    )
  })

  it('handles a single session', () => {
    const ts = new Date('2026-04-04T08:00:00.000Z')
    expect(latestSession([{ updatedAt: ts }])).toBe(ts.toISOString())
  })
})

describe('pickGranularity', () => {
  it('returns day when both dates are null', () => {
    expect(pickGranularity(null, null)).toBe('day')
  })

  it('returns day when only minDate is null', () => {
    expect(pickGranularity(null, new Date('2026-04-04T18:00:00Z'))).toBe('day')
  })

  it('returns day when only maxDate is null', () => {
    expect(pickGranularity(new Date('2026-04-04T08:00:00Z'), null)).toBe('day')
  })

  it('returns hour for a span under 48 hours', () => {
    const min = new Date('2026-04-04T08:00:00Z')
    const max = new Date('2026-04-04T18:00:00Z') // 10 h
    expect(pickGranularity(min, max)).toBe('hour')
  })

  it('returns hour for a span just under the 48-hour threshold', () => {
    const min = new Date('2026-04-04T00:00:00Z')
    const max = new Date('2026-04-05T23:59:59Z') // ~47.99 h
    expect(pickGranularity(min, max)).toBe('hour')
  })

  it('returns day for a span of exactly 48 hours', () => {
    const min = new Date('2026-04-04T00:00:00Z')
    const max = new Date('2026-04-06T00:00:00Z') // 48 h exactly
    expect(pickGranularity(min, max)).toBe('day')
  })

  it('returns day for a span between 48 hours and 30 days', () => {
    const min = new Date('2026-04-01T00:00:00Z')
    const max = new Date('2026-04-10T00:00:00Z') // 9 days
    expect(pickGranularity(min, max)).toBe('day')
  })

  it('returns week for a span over 30 days', () => {
    const min = new Date('2026-01-01T00:00:00Z')
    const max = new Date('2026-04-04T00:00:00Z') // ~93 days
    expect(pickGranularity(min, max)).toBe('week')
  })
})
