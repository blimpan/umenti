import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('../lib/prisma', () => ({
  default: {
    exercise: {
      findUnique: vi.fn(),
    },
    exerciseAttempt: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    exerciseAnalysis: {
      upsert: vi.fn(),
    },
  },
}))

vi.mock('./llm', () => ({ getModel: vi.fn(() => 'mock-model') }))

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, generateText: vi.fn() }
})

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { generateExerciseAnalysis } from './exerciseAnalysis'
import prisma from '../lib/prisma'
import { generateText } from 'ai'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExercise() {
  return {
    question: 'What is 2 + 2?',
    courseModule: { courseId: 42 },
  }
}

function makeAnswers(overrides: Array<{ answer: string | null }> = [
  { answer: 'Student answer one' },
  { answer: 'Student answer two' },
]) {
  return overrides
}

function mockLlmResult(summary: string, commonMisconceptions: string[]) {
  vi.mocked(generateText).mockResolvedValueOnce({
    experimental_output: { summary, commonMisconceptions },
    usage: {},
  } as any)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateExerciseAnalysis', () => {
  it('throws when exercise is not found', async () => {
    vi.mocked(prisma.exercise.findUnique).mockResolvedValueOnce(null)

    await expect(generateExerciseAnalysis(99)).rejects.toThrow('Exercise 99 not found')
  })

  it('throws when no attempts have answers', async () => {
    vi.mocked(prisma.exercise.findUnique).mockResolvedValueOnce(makeExercise() as any)
    vi.mocked(prisma.exerciseAttempt.findMany).mockResolvedValueOnce(
      makeAnswers([{ answer: null }, { answer: null }]) as any,
    )
    vi.mocked(prisma.exerciseAttempt.count).mockResolvedValueOnce(2)

    await expect(generateExerciseAnalysis(1)).rejects.toThrow(
      'No answers available for analysis',
    )
  })

  it('calls generateText with the exercise question in the prompt', async () => {
    vi.mocked(prisma.exercise.findUnique).mockResolvedValueOnce(makeExercise() as any)
    vi.mocked(prisma.exerciseAttempt.findMany).mockResolvedValueOnce(makeAnswers() as any)
    vi.mocked(prisma.exerciseAttempt.count).mockResolvedValueOnce(2)
    mockLlmResult('Students understood the concept.', ['Off-by-one errors'])
    vi.mocked(prisma.exerciseAnalysis.upsert).mockResolvedValueOnce({} as any)

    await generateExerciseAnalysis(1)

    const call = vi.mocked(generateText).mock.calls[0][0] as any
    // The prompt should include the exercise question somewhere
    const promptText = JSON.stringify(call.messages ?? '') + (call.system ?? '') + JSON.stringify(call.prompt ?? '')
    expect(promptText).toContain('What is 2 + 2?')
  })

  it('upserts the LLM result with the correct shape', async () => {
    vi.mocked(prisma.exercise.findUnique).mockResolvedValueOnce(makeExercise() as any)
    vi.mocked(prisma.exerciseAttempt.findMany).mockResolvedValueOnce(makeAnswers() as any)
    vi.mocked(prisma.exerciseAttempt.count).mockResolvedValueOnce(2)
    mockLlmResult('Good overall understanding.', ['Missed the carry'])
    vi.mocked(prisma.exerciseAnalysis.upsert).mockResolvedValueOnce({} as any)

    await generateExerciseAnalysis(1)

    const upsertCall = vi.mocked(prisma.exerciseAnalysis.upsert).mock.calls[0][0] as any
    expect(upsertCall.where).toEqual({ exerciseId: 1 })
    expect(upsertCall.create).toMatchObject({
      exerciseId: 1,
      courseId: 42,
      summary: 'Good overall understanding.',
      commonMisconceptions: ['Missed the carry'],
    })
    expect(upsertCall.update).toMatchObject({
      summary: 'Good overall understanding.',
      commonMisconceptions: ['Missed the carry'],
    })
  })

  it('uses total attempt count from DB (not the capped-50 slice) for attemptCountAtGeneration', async () => {
    vi.mocked(prisma.exercise.findUnique).mockResolvedValueOnce(makeExercise() as any)
    vi.mocked(prisma.exerciseAttempt.findMany).mockResolvedValueOnce(
      makeAnswers([
        { answer: 'Answer A' },
        { answer: 'Answer B' },
        { answer: 'Answer C' },
      ]) as any,
    )
    // totalCount is 200 — simulating many historical attempts beyond the 50-cap
    vi.mocked(prisma.exerciseAttempt.count).mockResolvedValueOnce(200)
    mockLlmResult('Summary', [])
    vi.mocked(prisma.exerciseAnalysis.upsert).mockResolvedValueOnce({} as any)

    await generateExerciseAnalysis(1)

    const upsertCall = vi.mocked(prisma.exerciseAnalysis.upsert).mock.calls[0][0] as any
    expect(upsertCall.create.attemptCountAtGeneration).toBe(200)
    expect(upsertCall.update.attemptCountAtGeneration).toBe(200)
  })
})
