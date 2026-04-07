import type { RichMessage } from '@metis/types'

type JSONContent = RichMessage['richContent']

/**
 * Walks a TipTap JSONContent tree and serialises it to a plain string.
 * Math chips are rendered as $latex$ (standard inline LaTeX notation).
 * Paragraph nodes append a newline so multi-paragraph messages stay readable.
 */
export function richContentToText(node: JSONContent): string {
  if (node.type === 'math') return `$${node.attrs?.latex ?? ''}$`
  if (node.type === 'text') return node.text ?? ''
  const children = (node.content ?? []).map(richContentToText).join('')
  if (node.type === 'paragraph') return children + '\n'
  return children
}
