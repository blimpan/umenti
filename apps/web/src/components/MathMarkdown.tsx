import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

interface Props {
  children: string
}

/**
 * Renders markdown with KaTeX math support.
 * Inline math: $...$  Block math: $$...$$  Currency: \$
 */
export default function MathMarkdown({ children }: Props) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {children}
    </ReactMarkdown>
  )
}
