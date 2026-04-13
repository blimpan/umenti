'use client'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { rewriteFragmentForCopy } from '@/lib/mathPaste'

interface Props {
  children: string
  className?: string
}

/**
 * Renders markdown with KaTeX math support.
 * Inline math: $...$  Block math: $$...$$  Currency: \$
 *
 * Intercepts copy events so that selecting rendered math and copying it puts
 * the LaTeX source ($latex$) on the clipboard instead of the unicode glyphs.
 */
export default function MathMarkdown({ children, className }: Props) {
  function handleCopy(e: React.ClipboardEvent<HTMLDivElement>) {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return
    const range = selection.getRangeAt(0)
    const fragment = range.cloneContents()
    const text = rewriteFragmentForCopy(fragment)
    if (text === null) return          // no math in selection — let browser handle
    e.preventDefault()
    e.clipboardData.setData('text/plain', text)
  }

  return (
    <div onCopy={handleCopy} className={className}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
