// apps/api/src/lib/mathCreation.ts
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { getModel } from './llm'
import { llmLogger } from './logger'
import { normalizeLatex } from './sympyClient'
import type { CanonicalExpression } from '@metis/types'

const ClaimsSchema = z.object({
  claims: z.array(z.object({
    label: z.string(),   // e.g. "f(x)", "domain D", "range V"
    latex: z.string(),   // LaTeX representation of the expected value
  })),
})

/**
 * Extracts the mathematical claims a student must demonstrate to answer an
 * exercise correctly, normalises each to a SymPy canonical form, and returns
 * the list ready for storage in Exercise.canonicalExpressions.
 *
 * Returns an empty array if the LLM call fails. Returns null sympyExpr for
 * claims that SymPy cannot normalise — those are always graded by LLM fallback.
 */
export async function extractCanonicalExpressions(
  question:     string,
  sampleAnswer: string,
): Promise<CanonicalExpression[]> {
  let rawClaims: Array<{ label: string; latex: string }>

  try {
    const { output } = await generateText({
      model:  getModel(),
      output: Output.object({ schema: ClaimsSchema }),
      system: [
        'You extract mathematical claims from exercise questions and sample answers.',
        'For each distinct value or expression a student must state, return a short label and its LaTeX.',
        'Only extract claims whose answer is mathematical (equations, expressions, sets, intervals).',
        'Omit prose requirements such as "explain why" or "describe the behaviour".',
      ].join(' '),
      messages: [{
        role:    'user',
        content: `Question: ${question}\n\nSample answer: ${sampleAnswer}`,
      }],
    })
    rawClaims = (output as z.infer<typeof ClaimsSchema>).claims
  } catch (err) {
    llmLogger.error({ err }, '[math-creation] LLM call failed — skipping canonicalExpressions')
    return []
  }

  if (rawClaims.length === 0) return []

  // Normalise each claim. Failures produce sympyExpr: null (LLM fallback at grading time).
  return Promise.all(
    rawClaims.map(async (claim): Promise<CanonicalExpression> => {
      const result = await normalizeLatex(claim.latex)
      return {
        label:     claim.label,
        sympyExpr: 'error' in result ? null : result.sympyExpr,
      }
    }),
  )
}
