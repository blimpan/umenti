import { describe, it, expect } from 'vitest'
import { validateMathSyntax } from './mathValidation'

describe('validateMathSyntax', () => {
  describe('valid content', () => {
    it('passes plain text with no math', () => {
      const result = validateMathSyntax('The quick brown fox.')
      expect(result.valid).toBe(true)
    })

    it('passes inline math with $...$', () => {
      const result = validateMathSyntax('The derivative of $f(x) = x^2$ is $2x$.')
      expect(result.valid).toBe(true)
    })

    it('passes block math with $$$...$$$ on its own line', () => {
      const result = validateMathSyntax('Evaluate:\n\n$$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$\n\nNote the bounds.')
      expect(result.valid).toBe(true)
    })

    it('passes escaped currency \\$', () => {
      const result = validateMathSyntax('The price is \\$50 and the discount is \\$10.')
      expect(result.valid).toBe(true)
    })

    it('passes mixed math and escaped currency', () => {
      const result = validateMathSyntax('If $P = \\$200$ and interest rate is $r = 0.05$, the return is $Pr$.')
      expect(result.valid).toBe(true)
    })

    it('passes multivariable calculus content', () => {
      const result = validateMathSyntax(
        'The gradient is $\\nabla f = (\\frac{\\partial f}{\\partial x}, \\frac{\\partial f}{\\partial y})$.\n\n$$\\iint_D f(x,y) \\, dA$$'
      )
      expect(result.valid).toBe(true)
    })
  })

  describe('forbidden: \\(...\\) delimiters', () => {
    it('rejects \\( \\) inline delimiters', () => {
      const result = validateMathSyntax('The slope is \\(\\frac{dy}{dx}\\).')
      expect(result.valid).toBe(false)
      expect(result.errors[0].rule).toBe('no-paren-delimiters')
    })
  })

  describe('forbidden: \\[...\\] delimiters', () => {
    it('rejects \\[ \\] block delimiters', () => {
      const result = validateMathSyntax('See below:\n\\[\\int_0^1 x \\, dx\\]')
      expect(result.valid).toBe(false)
      expect(result.errors[0].rule).toBe('no-bracket-delimiters')
    })
  })

  describe('forbidden: bare $ for currency', () => {
    it('rejects bare $ before a digit', () => {
      const result = validateMathSyntax('The cost is $50 per unit.')
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.rule === 'no-bare-currency')).toBe(true)
    })
  })

  describe('unbalanced $ delimiters', () => {
    it('rejects odd number of unescaped $', () => {
      const result = validateMathSyntax('The value $x + y is positive.')
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.rule === 'balanced-inline-delimiters')).toBe(true)
    })

    it('does not count $$ toward inline balance', () => {
      // Block math $$...$$ — the stripped content has no lone $ so balance should pass
      const result = validateMathSyntax('$$x^2 + y^2 = r^2$$')
      expect(result.valid).toBe(true)
    })
  })
})
