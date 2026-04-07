import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MathNodeView } from './MathNodeView'

export interface MathNodeOptions {
  onEditMath?: (latex: string, onInsert: (newLatex: string) => void) => void
}

export const MathNode = Node.create<MathNodeOptions>({
  name: 'math',
  group: 'inline',
  inline: true,
  atom: true,  // atom = cursor treats this as a single indivisible unit

  addOptions() {
    return { onEditMath: undefined }
  },

  addAttributes() {
    return { latex: { default: '' } }
  },

  parseHTML() {
    return [{ tag: 'span[data-math]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-math': '' })]
  },

  // TipTap v3: controls what text/plain contains when this node is copied.
  // Without this, copying a math chip produces empty text.
  renderText({ node }) {
    return `$${node.attrs.latex as string}$`
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView)
  },
})
