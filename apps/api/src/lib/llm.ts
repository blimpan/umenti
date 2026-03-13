import { createAnthropic } from '@ai-sdk/anthropic'

/**
 * Returns the configured LLM model for generation.
 *
 * To swap providers:
 *   1. Install the provider package: pnpm --filter @metis/api add @ai-sdk/<provider>
 *   2. Set LLM_PROVIDER (and optionally LLM_MODEL) in your .env
 *   3. Add a case below
 *
 * Supported: 'anthropic' (default)
 */
export function getModel() {
  const provider = process.env.LLM_PROVIDER ?? 'anthropic'
  const modelId = process.env.LLM_MODEL

  switch (provider) {
    case 'anthropic':
      return createAnthropic()(modelId ?? 'claude-sonnet-4-6')
    default:
      throw new Error(`Unsupported LLM_PROVIDER: "${provider}". Add it in src/lib/llm.ts.`)
  }
}
