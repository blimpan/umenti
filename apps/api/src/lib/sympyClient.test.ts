import { describe, it, expect, vi, afterEach } from 'vitest'
import { normalizeLatex, checkEquivalence, evaluateAtPoints } from './sympyClient'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

afterEach(() => mockFetch.mockReset())

describe('normalizeLatex', () => {
  it('returns sympyExpr on HTTP 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sympyExpr: '2*3**x' }),
    })
    const result = await normalizeLatex('2 \\cdot 3^x')
    expect(result).toEqual({ sympyExpr: '2*3**x' })
  })

  it('returns error object on HTTP 422', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'parse error' }),
    })
    const result = await normalizeLatex('\\notvalid{')
    expect(result).toEqual({ error: 'parse error' })
  })

  it('returns error when fetch throws (service down)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('connection refused'))
    const result = await normalizeLatex('x^2')
    expect('error' in result).toBe(true)
  })
})

describe('checkEquivalence', () => {
  it('returns equivalent=true when service responds so', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ equivalent: true }),
    })
    const result = await checkEquivalence('2*3**x', '2*3**x')
    expect(result).toEqual({ equivalent: true })
  })

  it('returns equivalent=false with error when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'))
    const result = await checkEquivalence('a', 'b')
    expect(result.equivalent).toBe(false)
    expect(result.error).toBe('timeout')
  })
})

describe('evaluateAtPoints', () => {
  it('returns equivalent=true when service responds so', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ equivalent: true }),
    })
    const result = await evaluateAtPoints('2*x', '2*x', [1, 2, 3])
    expect(result).toEqual({ equivalent: true })
  })
})
