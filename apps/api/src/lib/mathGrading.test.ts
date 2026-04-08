import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gradeMathExercise } from './mathGrading'
import type { CanonicalExpression } from '@metis/types'

vi.mock('./llm',    () => ({ getModel: vi.fn(() => 'mock-model') }))
vi.mock('./logger', () => ({ llmLogger: { error: vi.fn(), info: vi.fn() } }))

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, generateText: vi.fn() }
})

vi.mock('./sympyClient', () => ({
  normalizeLatex:   vi.fn(),
  checkEquivalence: vi.fn(),
  evaluateAtPoints: vi.fn(),
}))

import { generateText } from 'ai'
import * as sympyClient from './sympyClient'

const TWO_CLAIMS: CanonicalExpression[] = [
  { label: 'f(x)', sympyExpr: '2*3**x' },
  { label: 'domain D', sympyExpr: 'S.Reals' },
]

function mockExtraction(claims: Array<{ label: string; studentLatex?: string | null; studentPhrase?: string | null }>) {
  vi.mocked(generateText).mockResolvedValueOnce({
    output: { claims },
    usage: {},
  } as any)
}

beforeEach(() => {
  vi.mocked(sympyClient.normalizeLatex).mockResolvedValue({ sympyExpr: 'mock_normalised' })
  vi.mocked(sympyClient.checkEquivalence).mockResolvedValue({ equivalent: true })
})

describe('gradeMathExercise', () => {
  it('returns correct=true, scoreChange=20 when all claims pass SymPy', async () => {
    mockExtraction([
      { label: 'f(x)',     studentLatex: '2 \\cdot 3^x', studentPhrase: null },
      { label: 'domain D', studentLatex: '\\mathbb{R}',  studentPhrase: null },
    ])

    const result = await gradeMathExercise('question', TWO_CLAIMS, 'rubric', 'student answer')

    expect(result).not.toBeNull()
    expect(result!.correct).toBe(true)
    expect(result!.scoreChange).toBe(20)
    expect(result!.claimResults.every(r => r.method === 'sympy')).toBe(true)
  })

  it('returns almost=true, scoreChange=0 when exactly half of claims pass', async () => {
    mockExtraction([
      { label: 'f(x)',     studentLatex: '2*3^x',       studentPhrase: null },
      { label: 'domain D', studentLatex: '\\mathbb{R}', studentPhrase: null },
    ])
    vi.mocked(sympyClient.checkEquivalence)
      .mockResolvedValueOnce({ equivalent: true })
      .mockResolvedValueOnce({ equivalent: false })

    const result = await gradeMathExercise('question', TWO_CLAIMS, 'rubric', 'student answer')

    expect(result!.almost).toBe(true)
    expect(result!.correct).toBe(false)
    expect(result!.scoreChange).toBe(0)
  })

  it('returns correct=false, scoreChange=-10 when no claims pass', async () => {
    mockExtraction([
      { label: 'f(x)',     studentLatex: 'wrong',  studentPhrase: null },
      { label: 'domain D', studentLatex: 'wrong2', studentPhrase: null },
    ])
    vi.mocked(sympyClient.checkEquivalence).mockResolvedValue({ equivalent: false })

    const result = await gradeMathExercise('question', TWO_CLAIMS, 'rubric', 'student answer')

    expect(result!.correct).toBe(false)
    expect(result!.almost).toBe(false)
    expect(result!.scoreChange).toBe(-10)
  })

  it('marks a claim as missing when student does not address it', async () => {
    mockExtraction([
      { label: 'f(x)',     studentLatex: '2*3^x', studentPhrase: null },
      { label: 'domain D', studentLatex: null,    studentPhrase: null },
    ])

    const result = await gradeMathExercise('question', TWO_CLAIMS, 'rubric', 'student answer')

    const domainResult = result!.claimResults.find(r => r.label === 'domain D')!
    expect(domainResult.method).toBe('missing')
    expect(domainResult.correct).toBe(false)
  })

  it('falls back to LLM for a claim with null sympyExpr', async () => {
    const claimsWithNullSympy: CanonicalExpression[] = [
      { label: 'explanation', sympyExpr: null },
    ]
    mockExtraction([
      { label: 'explanation', studentLatex: null, studentPhrase: 'because the base is 3' },
    ])
    vi.mocked(generateText).mockResolvedValueOnce({ output: { correct: true }, usage: {} } as any)

    const result = await gradeMathExercise('question', claimsWithNullSympy, 'rubric', 'student answer')

    expect(result!.claimResults[0].method).toBe('llm')
    expect(result!.claimResults[0].correct).toBe(true)
  })

  it('returns null when the extraction LLM call throws', async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error('LLM unreachable'))

    const result = await gradeMathExercise('question', TWO_CLAIMS, 'rubric', 'student answer')

    expect(result).toBeNull()
  })
})
