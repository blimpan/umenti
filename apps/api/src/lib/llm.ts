import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'

/**
 * Returns the configured LLM model for generation.
 *
 * To swap providers:
 *   1. Install the provider package: pnpm --filter @metis/api add @ai-sdk/<provider>
 *   2. Set LLM_PROVIDER (and optionally LLM_MODEL) in your .env
 *   3. Add a case below
 *
 * Supported: 'google' (default), 'anthropic', 'openai'
 */
export function getModel() {
  const provider = process.env.LLM_PROVIDER ?? 'openai'
  const modelId = process.env.LLM_MODEL

  switch (provider) {
    case 'anthropic':
      return createAnthropic()(modelId ?? 'claude-sonnet-4-6')
    case 'google':
      return createGoogleGenerativeAI()(modelId ?? 'gemini-3-flash-preview')
    case 'openai':
      return createOpenAI()(modelId ?? 'gpt-4o')
    default:
      throw new Error(`Unsupported LLM_PROVIDER: "${provider}". Add it in src/lib/llm.ts.`)
  }
}
