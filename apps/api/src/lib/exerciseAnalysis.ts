// apps/api/src/lib/exerciseAnalysis.ts
import { generateText, Output } from 'ai'
import { z } from 'zod'
import prisma from '../lib/prisma'
import { getModel } from './llm'

// ---------------------------------------------------------------------------
// Zod schema for LLM structured output
// ---------------------------------------------------------------------------

const AnalysisSchema = z.object({
  summary: z.string(),
  commonMisconceptions: z.array(z.string()),
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates (or regenerates) an AI analysis for an exercise based on the
 * actual answers students have submitted.
 *
 * Loads the exercise + up to 50 most-recent answers, calls the LLM for a
 * summary and list of common misconceptions, then upserts the result into
 * ExerciseAnalysis.
 *
 * Throws 'No answers available for analysis' when no attempts have a
 * recorded answer string.
 */
export async function generateExerciseAnalysis(exerciseId: number): Promise<void> {
  // -------------------------------------------------------------------------
  // 1. Load exercise data (exercise row only — no relation to attempts)
  // -------------------------------------------------------------------------
  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: {
      question: true,
      courseModule: {
        select: { courseId: true },
      },
    },
  })

  if (!exercise) {
    throw new Error(`Exercise ${exerciseId} not found`)
  }

  // -------------------------------------------------------------------------
  // 2. Load answers and total count in parallel
  // -------------------------------------------------------------------------
  const [answers, totalAttemptCount] = await Promise.all([
    prisma.exerciseAttempt.findMany({
      where: { exerciseId, answer: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { answer: true },
    }),
    prisma.exerciseAttempt.count({ where: { exerciseId } }),
  ])

  // -------------------------------------------------------------------------
  // 3. Guard: require at least one answer
  // -------------------------------------------------------------------------
  const answeredAttempts = answers.filter(
    (a): a is { answer: string } => a.answer !== null,
  )

  if (answeredAttempts.length === 0) {
    throw new Error('No answers available for analysis')
  }

  const courseId = exercise.courseModule.courseId

  // -------------------------------------------------------------------------
  // 4. Call the LLM
  // -------------------------------------------------------------------------
  const answerList = answeredAttempts
    .map((a, i) => `${i + 1}. ${a.answer}`)
    .join('\n')

  const { experimental_output } = await generateText({
    model: getModel(),
    experimental_output: Output.object({ schema: AnalysisSchema }),
    messages: [
      {
        role: 'user',
        content: [
          `Exercise question: ${exercise.question}`,
          '',
          'Student answers:',
          answerList,
          '',
          'Please summarize the overall patterns in student understanding and identify the most common misconceptions.',
        ].join('\n'),
      },
    ],
  })

  if (!experimental_output) {
    throw new Error('LLM did not return structured output')
  }

  const result = experimental_output as z.infer<typeof AnalysisSchema>

  // -------------------------------------------------------------------------
  // 5. Upsert into ExerciseAnalysis
  // -------------------------------------------------------------------------
  await prisma.exerciseAnalysis.upsert({
    where: { exerciseId },
    create: {
      exerciseId,
      courseId,
      summary: result.summary,
      commonMisconceptions: result.commonMisconceptions,
      attemptCountAtGeneration: totalAttemptCount,
    },
    update: {
      summary: result.summary,
      commonMisconceptions: result.commonMisconceptions,
      attemptCountAtGeneration: totalAttemptCount,
      generatedAt: new Date(),
    },
  })
}
