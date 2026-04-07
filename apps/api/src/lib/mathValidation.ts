// Validates that a generated content string follows the canonical math syntax
// contract defined in docs/math-syntax.md.
// Used in Phase 2 to check generated content before persisting.

// Injected into all content-generating prompts. Must stay consistent with docs/math-syntax.md.
export const MATH_SYNTAX_CONTRACT = `
MATH FORMATTING RULES (required — renderer only supports these delimiters)
- Inline math: $...$ (e.g. "The slope is $\\frac{\\Delta y}{\\Delta x}$")
- Block/display math: $$...$$ on its own line (e.g. "$$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$")
- Literal dollar sign (currency): \\$ (e.g. "costs \\$50")
- NEVER use \\(...\\) or \\[...\\] — these are not supported and will render as raw text
- NEVER place $$...$$ inline inside a sentence — it must be on its own line
- NEVER use a bare $ for currency — always escape it as \\$
`.trim()

export interface MathValidationError {
  rule: string
  detail: string
}

export interface MathValidationResult {
  valid: boolean
  errors: MathValidationError[]
}

export function validateMathSyntax(content: string): MathValidationResult {
  const errors: MathValidationError[] = []

  // Forbidden: \(...\) inline delimiter
  if (/\\\([\s\S]*?\\\)/.test(content)) {
    errors.push({
      rule: 'no-paren-delimiters',
      detail: 'Found \\(...\\) — use $...$ for inline math instead',
    })
  }

  // Forbidden: \[...\] block delimiter
  if (/\\\[[\s\S]*?\\\]/.test(content)) {
    errors.push({
      rule: 'no-bracket-delimiters',
      detail: 'Found \\[...\\] — use $$...$$ on its own line for block math instead',
    })
  }

  // Forbidden: bare $ used for currency.
  // Heuristic: $ followed by digits only (like $50 or $10.99) — not a math expression.
  // Math expressions starting with a digit ($2x$, $3\pi$) will have word chars after the digits.
  if (/(?<![\\\$])\$\d+(?:[,.]\d+)*(?!\w)/.test(content)) {
    errors.push({
      rule: 'no-bare-currency',
      detail: 'Found bare $ before a digit — use \\$ for currency',
    })
  }

  // Unbalanced inline $ delimiters (odd count of unescaped $, excluding $$)
  const stripped = content.replace(/\$\$/g, '').replace(/\\\$/g, '')
  const dollarCount = (stripped.match(/\$/g) ?? []).length
  if (dollarCount % 2 !== 0) {
    errors.push({
      rule: 'balanced-inline-delimiters',
      detail: `Unbalanced inline $ delimiters (found ${dollarCount} unescaped $)`,
    })
  }

  return { valid: errors.length === 0, errors }
}
