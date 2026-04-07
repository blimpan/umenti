// apps/api/src/lib/mathGrading.ts
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { getModel } from './llm'
import { llmLogger } from './logger'
import { normalizeLatex, checkEquivalence, evaluateAtPoints } from './sympyClient'
import type { CanonicalExpression } from '@metis/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClaimVerificationMethod = 'sympy' | 'llm' | 'missing'

export type ClaimResult = {
  label:   string
  correct: boolean
  method:  ClaimVerificationMethod
}

export type MathGradingResult = {
  correct:      boolean
  almost:       boolean
  scoreChange:  number
  claimResults: ClaimResult[]
}

// ---------------------------------------------------------------------------
// Zod schemas for LLM structured output
// ---------------------------------------------------------------------------

const ExtractionSchema = z.object({
  claims: z.array(z.object({
    label:         z.string(),
    studentLatex:  z.string().nullable(),
    studentPhrase: z.string().nullable(),
  })),
})

const LlmClaimSchema = z.object({
  correct: z.boolean(),
})

// ---------------------------------------------------------------------------
// Step 1 — Extraction LLM call
// ---------------------------------------------------------------------------

async function extractStudentClaims(
  question:    string,
  claimLabels: string[],
  studentAnswer: string,
): Promise<z.infer<typeof ExtractionSchema>['claims']> {
  const { output } = await generateText({
    model:  getModel(),
    output: Output.object({ schema: ExtractionSchema }),
    system: [
      'You extract mathematical claims from student answers.',
      'For each expected claim label, find what the student expressed.',
      'If mathematical: return as studentLatex (LaTeX).',
      'Convert unambiguous natural language to LaTeX: "all real numbers" → "\\\\mathbb{R}", "positive reals" → "(0, \\\\infty)", "x equals 3" → "x = 3".',
      'If prose only (cannot be reduced to a single expression): return as studentPhrase.',
      'If the student did not address the claim: return null for both fields.',
    ].join(' '),
    messages: [{
      role:    'user',
      content: `Question: ${question}\nExpected claims: ${claimLabels.join(', ')}\nStudent answer: ${studentAnswer}`,
    }],
  })
  return (output as z.infer<typeof ExtractionSchema>).claims
}

// ---------------------------------------------------------------------------
// Step 2 — SymPy verification for one claim
// ---------------------------------------------------------------------------

async function verifyWithSympy(
  sympyExpr:    string,
  studentLatex: string,
): Promise<{ equivalent: boolean; error?: string }> {
  const normalised = await normalizeLatex(studentLatex)
  if ('error' in normalised) return { equivalent: false, error: normalised.error }

  const primary = await checkEquivalence(sympyExpr, normalised.sympyExpr)
  if (!primary.error) return primary

  // Numerical fallback for transcendental or complex expressions
  return evaluateAtPoints(sympyExpr, normalised.sympyExpr, [0.5, 1, 2, Math.PI, -1])
}

// ---------------------------------------------------------------------------
// Step 3 — Per-claim LLM fallback
// ---------------------------------------------------------------------------

async function gradeClaimWithLlm(
  label:             string,
  sympyExpr:         string | null,
  studentExpression: string,
  rubric:            string,
): Promise<boolean> {
  try {
    const { output } = await generateText({
      model:  getModel(),
      output: Output.object({ schema: LlmClaimSchema }),
      system: 'You are a math teacher grading one specific claim in a student answer. Return correct=true only if the student correctly addressed this claim.',
      messages: [{
        role:    'user',
        content: [
          `Claim: ${label}`,
          `Expected: ${sympyExpr ?? '(see rubric)'}`,
          `Rubric: ${rubric}`,
          `Student said: ${studentExpression}`,
        ].join('\n'),
      }],
    })
    return (output as z.infer<typeof LlmClaimSchema>).correct
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Grades a free-text exercise that has canonicalExpressions stored.
 * Returns null if the extraction LLM call fails (caller should fall back to gradeFreeText).
 */
export async function gradeMathExercise(
  question:             string,
  canonicalExpressions: CanonicalExpression[],
  rubric:               string,
  studentAnswer:        string,
): Promise<MathGradingResult | null> {
  const claimLabels = canonicalExpressions.map(c => c.label)

  let extractedClaims: z.infer<typeof ExtractionSchema>['claims']
  try {
    extractedClaims = await extractStudentClaims(question, claimLabels, studentAnswer)
  } catch (err) {
    llmLogger.error({ err }, '[math-grading] extraction LLM call failed')
    return null
  }

  const claimResults: ClaimResult[] = await Promise.all(
    canonicalExpressions.map(async (canonical): Promise<ClaimResult> => {
      const extracted = extractedClaims.find(c => c.label === canonical.label)

      // Student did not address this claim at all
      if (!extracted || (!extracted.studentLatex && !extracted.studentPhrase)) {
        return { label: canonical.label, correct: false, method: 'missing' }
      }

      // Attempt SymPy verification when both canonical expr and student LaTeX are available
      if (canonical.sympyExpr && extracted.studentLatex) {
        const result = await verifyWithSympy(canonical.sympyExpr, extracted.studentLatex)
        if (!result.error) {
          return { label: canonical.label, correct: result.equivalent, method: 'sympy' }
        }
        // SymPy errored — fall through to LLM
      }

      // LLM fallback
      const studentExpression = extracted.studentLatex ?? extracted.studentPhrase ?? ''
      const correct = await gradeClaimWithLlm(canonical.label, canonical.sympyExpr, studentExpression, rubric)
      return { label: canonical.label, correct, method: 'llm' }
    }),
  )

  const passCount  = claimResults.filter(r => r.correct).length
  const totalCount = claimResults.length
  const correct    = passCount === totalCount
  const almost     = !correct && passCount >= Math.ceil(totalCount / 2)
  const scoreChange = correct ? 20 : almost ? 0 : -10

  llmLogger.info({ passCount, totalCount, correct, almost, scoreChange }, '[math-grading] result')

  return { correct, almost, scoreChange, claimResults }
}
