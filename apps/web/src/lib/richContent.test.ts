import { describe, it, expect } from 'vitest'
import { richContentToText } from './richContent'

describe('richContentToText', () => {
  it('returns empty string for an empty doc', () => {
    expect(richContentToText({ type: 'doc', content: [] })).toBe('')
  })

  it('extracts plain text from a paragraph', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
    }
    expect(richContentToText(doc).trim()).toBe('hello')
  })

  it('wraps a math node in $...$', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'math', attrs: { latex: '1+1=2' } }] }],
    }
    expect(richContentToText(doc).trim()).toBe('$1+1=2$')
  })

  it('handles mixed text and math in one paragraph', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'The answer is ' },
          { type: 'math', attrs: { latex: 'x=2' } },
        ],
      }],
    }
    expect(richContentToText(doc).trim()).toBe('The answer is $x=2$')
  })

  it('joins multiple paragraphs with newlines', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'line one' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'line two' }] },
      ],
    }
    expect(richContentToText(doc)).toBe('line one\nline two\n')
  })

  it('returns empty string for math node with no latex attr', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'math', attrs: {} }] }],
    }
    expect(richContentToText(doc).trim()).toBe('$$')
  })
})
