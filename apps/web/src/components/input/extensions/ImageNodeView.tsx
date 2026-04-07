'use client'

import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import type { ImageNodeOptions } from './ImageNode'

export function ImageNodeView({ node, deleteNode, extension }: NodeViewProps) {
  const { url, filename } = node.attrs as { url: string; filename: string }
  const { onImageClick } = extension.options as ImageNodeOptions
  const showRemoveButton = !onImageClick

  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <span
        onClick={() => onImageClick?.(url)}
        className={`inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2 py-0.5 text-xs text-gray-700 align-middle ${!showRemoveButton ? 'cursor-pointer hover:bg-gray-50' : ''}`}
      >
        {/* Tiny preview thumbnail */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="w-4 h-4 rounded object-cover" />
        <span className="max-w-[120px] truncate">{filename}</span>
        {showRemoveButton && (
          <button
            onMouseDown={e => { e.preventDefault(); deleteNode() }}
            className="text-gray-300 hover:text-gray-500 text-xs leading-none"
            aria-label="Remove image"
          >
            ×
          </button>
        )}
      </span>
    </NodeViewWrapper>
  )
}
