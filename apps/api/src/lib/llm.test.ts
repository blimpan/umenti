import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock hoists these to the top of the file before any imports,
// so the real SDK modules are never loaded during this test.
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => vi.fn(() => 'google-model-instance')),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(() => vi.fn(() => 'anthropic-model-instance')),
}))

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { getModel } from './llm'

describe('getModel()', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Restore mock implementations after reset
    vi.mocked(createGoogleGenerativeAI).mockReturnValue(vi.fn(() => 'google-model-instance') as any)
    vi.mocked(createAnthropic).mockReturnValue(vi.fn(() => 'anthropic-model-instance') as any)
    delete process.env.LLM_PROVIDER
    delete process.env.LLM_MODEL
  })

  it('defaults to Google when LLM_PROVIDER is not set', () => {
    // assert that calling getModel() without any env vars
    // uses the Google provider and returns the expected model instance.
    // Hint: call getModel(), then check createGoogleGenerativeAI was called
    // and the return value is 'google-model-instance'.
    const model = getModel()
    expect(createGoogleGenerativeAI).toHaveBeenCalled()
    expect(model).toBe('google-model-instance')

  })

  it('uses the custom model ID from LLM_MODEL when set', () => {
    // set process.env.LLM_MODEL to a custom string like 'gemini-custom',
    // call getModel(), then verify the inner factory (the fn returned by
    // createGoogleGenerativeAI()) was called with that exact model ID.
    const customModelId = 'gemini-custom'
    process.env.LLM_MODEL = customModelId
    const model = getModel()
    const innerFactory = vi.mocked(createGoogleGenerativeAI).mock.results[0].value
    expect(innerFactory).toHaveBeenCalledWith(customModelId)
    expect(model).toBe('google-model-instance')
  })

  it('selects Anthropic when LLM_PROVIDER is "anthropic"', () => {
    process.env.LLM_PROVIDER = 'anthropic'
    const model = getModel()
    expect(createAnthropic).toHaveBeenCalled()
    expect(model).toBe('anthropic-model-instance')
  })

  it('throws on an unsupported provider', () => {
    process.env.LLM_PROVIDER = 'xai'
    expect(() => getModel()).toThrowError(/Unsupported LLM_PROVIDER/)
  })
})
