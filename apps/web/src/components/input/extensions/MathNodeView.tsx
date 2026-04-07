'use client'

import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { MathChip } from '../MathChip'
import type { MathNodeOptions } from './MathNode'

export function MathNodeView({ node, deleteNode, updateAttributes, extension }: NodeViewProps) {
  const latex = node.attrs.latex as string
  const { onEditMath } = extension.options as MathNodeOptions

  function handleClick() {
    onEditMath?.(latex, newLatex => {
      // Update the node's attrs in place — no delete+insert needed
      updateAttributes({ latex: newLatex })
    })
  }

  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <MathChip latex={latex} onClick={onEditMath ? handleClick : undefined} onRemove={deleteNode} />
    </NodeViewWrapper>
  )
}
