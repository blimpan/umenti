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

/**
 * Rewrites a DocumentFragment that may contain KaTeX-rendered math by
 * replacing each .katex span with its LaTeX source as $latex$ or $$latex$$.
 *
 * Returns the resulting textContent, or null if no math was found or replaced
 * (so the caller knows not to intercept the copy event).
 *
 * Browser-only — relies on the global `document` to create text nodes.
 */
export function rewriteFragmentForCopy(fragment: DocumentFragment): string | null {
  const katexSpans = Array.from(fragment.querySelectorAll('.katex'))

  if (katexSpans.length === 0) return null

  let replaced = 0

  for (const span of katexSpans) {
    const annotation = span.querySelector('annotation[encoding="application/x-tex"]')
    if (!annotation) continue

    const latex = annotation.textContent ?? ''
    const isDisplay = span.closest('.katex-display') !== null
    const text = isDisplay ? `$$${latex}$$` : `$${latex}$`

    span.parentNode?.replaceChild(document.createTextNode(text), span)
    replaced++
  }

  if (replaced === 0) return null

  return fragment.textContent
}
