export type MathToken =
  | { type: 'text'; value: string }
  | { type: 'math'; latex: string }

export function tokenizeMathText(text: string): MathToken[] {
  if (text === '') return []

  const tokens: MathToken[] = []
  const regex = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const rawLatex = match[1] ?? match[2]
    const latex = rawLatex.trim()

    // Currency guard: skip pure numbers/decimals
    if (/^[\d.,]+$/.test(latex)) {
      // Do NOT update last — absorbed into surrounding text
      continue
    }

    // Text before this match
    if (match.index > last) {
      tokens.push({ type: 'text', value: text.slice(last, match.index) })
    }

    tokens.push({ type: 'math', latex })
    last = match.index + match[0].length
  }

  // Remaining text after last match
  if (last < text.length) {
    tokens.push({ type: 'text', value: text.slice(last) })
  }

  return tokens
}
