// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { tokenizeMathText, rewriteFragmentForCopy } from './mathPaste'

describe('tokenizeMathText', () => {
  it('returns a single text token for plain text with no math', () => {
    expect(tokenizeMathText('hello world')).toEqual([
      { type: 'text', value: 'hello world' },
    ])
  })

  it('returns a single math token for a bare $...$', () => {
    expect(tokenizeMathText('$a + b$')).toEqual([
      { type: 'math', latex: 'a + b' },
    ])
  })

  it('handles inline math surrounded by text', () => {
    expect(tokenizeMathText('with $a \\neq 0$ here')).toEqual([
      { type: 'text', value: 'with ' },
      { type: 'math', latex: 'a \\neq 0' },
      { type: 'text', value: ' here' },
    ])
  })

  it('handles multiple math expressions', () => {
    expect(tokenizeMathText('$a$ and $b$')).toEqual([
      { type: 'math', latex: 'a' },
      { type: 'text', value: ' and ' },
      { type: 'math', latex: 'b' },
    ])
  })

  it('handles $$...$$ block math', () => {
    expect(tokenizeMathText('$$\\frac{x}{2}$$')).toEqual([
      { type: 'math', latex: '\\frac{x}{2}' },
    ])
  })

  it('leaves pure-number $...$ as plain text (currency guard)', () => {
    expect(tokenizeMathText('costs $50$ to buy')).toEqual([
      { type: 'text', value: 'costs $50$ to buy' },
    ])
  })

  it('returns empty array for empty string', () => {
    expect(tokenizeMathText('')).toEqual([])
  })

  it('trims whitespace from extracted latex', () => {
    expect(tokenizeMathText('$  x + 1  $')).toEqual([
      { type: 'math', latex: 'x + 1' },
    ])
  })
})

function makeFragment(html: string): DocumentFragment {
  return document.createRange().createContextualFragment(html)
}

describe('rewriteFragmentForCopy', () => {
  it('returns null when no .katex elements present', () => {
    const fragment = makeFragment('<p>plain text</p>')
    expect(rewriteFragmentForCopy(fragment)).toBeNull()
  })

  it('replaces inline .katex span with $latex$', () => {
    const fragment = makeFragment(
      'before <span class="katex"><math><semantics><annotation encoding="application/x-tex">a \\neq 0</annotation></semantics></math></span> after'
    )
    expect(rewriteFragmentForCopy(fragment)).toBe('before $a \\neq 0$ after')
  })

  it('uses $$latex$$ for .katex inside .katex-display', () => {
    const fragment = makeFragment(
      '<span class="katex-display"><span class="katex"><math><semantics><annotation encoding="application/x-tex">\\frac{x}{2}</annotation></semantics></math></span></span>'
    )
    expect(rewriteFragmentForCopy(fragment)).toBe('$$\\frac{x}{2}$$')
  })

  it('handles multiple .katex spans', () => {
    const fragment = makeFragment(
      'x = <span class="katex"><math><semantics><annotation encoding="application/x-tex">a</annotation></semantics></math></span> and y = <span class="katex"><math><semantics><annotation encoding="application/x-tex">b</annotation></semantics></math></span>'
    )
    expect(rewriteFragmentForCopy(fragment)).toBe('x = $a$ and y = $b$')
  })

  it('returns null when .katex exists but has no annotation element', () => {
    const fragment = makeFragment('<span class="katex"><span class="katex-html">x</span></span>')
    expect(rewriteFragmentForCopy(fragment)).toBeNull()
  })
})
