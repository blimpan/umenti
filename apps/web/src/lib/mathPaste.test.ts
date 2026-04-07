import { describe, it, expect } from 'vitest'
import { tokenizeMathText } from './mathPaste'

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
