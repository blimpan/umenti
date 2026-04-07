import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { getModel } from './llm'
import { validateMathSyntax, MATH_SYNTAX_CONTRACT } from './mathValidation'

// Requires a real GEMINI_API_KEY (or LLM_PROVIDER + key) in your .env.
// Run with: pnpm --filter @metis/api test:integration
describe('LLM integration', () => {
  let originalModel: string | undefined

  beforeAll(() => {
    originalModel = process.env.LLM_MODEL
    process.env.LLM_MODEL = 'gpt-4o'
  })

  afterAll(() => {
    process.env.LLM_MODEL = originalModel
  })

  it('gets a response from the configured provider', async () => {
    const model = getModel()
    const result = await generateText({
      model,
      prompt: 'Reply with exactly the word: pong',
      maxOutputTokens: 20,
      providerOptions: {
        google: { thinkingConfig: { thinkingLevel: 'minimal' } },
      },
    })
    expect(result.text.toLowerCase()).toContain('pong')
  }, 15_000) // 15s timeout for network call

  it('generates math content that passes the syntax contract', async () => {
    const MathContentSchema = z.object({
      blocks: z.array(z.string()),
    })

    const { output } = await generateText({
      model:  getModel(),
      output: Output.object({ schema: MathContentSchema }),
      prompt: `
Generate 3 short theory paragraphs (1–2 sentences each) about multivariable calculus.
Cover: (1) partial derivatives, (2) the gradient vector, (3) double integrals.
Each paragraph must contain at least one inline math expression and one block math expression.

${MATH_SYNTAX_CONTRACT}

Return the paragraphs as an array of strings in the "blocks" field.
`.trim(),
    })

    const result = output as z.infer<typeof MathContentSchema>

    expect(result.blocks).toHaveLength(3)

    for (const block of result.blocks) {
      const validation = validateMathSyntax(block)
      expect(
        validation.errors,
        `Block failed math validation:\n"${block}"\nErrors: ${validation.errors.map(e => `[${e.rule}] ${e.detail}`).join(', ')}`
      ).toHaveLength(0)

      // Each block must contain at least one math delimiter to confirm the
      // LLM actually used math rather than writing around it.
      expect(block, `Block contains no math delimiters:\n"${block}"`).toMatch(/\$/)
    }
  }, 30_000) // 30s — structured output calls are slower
})
