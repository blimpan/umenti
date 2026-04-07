import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageNodeView } from './ImageNodeView'

export interface ImageNodeOptions {
  onImageClick?: (url: string) => void
}

export const ImageNode = Node.create<ImageNodeOptions>({
  name: 'attachment',
  group: 'inline',
  inline: true,
  atom: true,

  addOptions() {
    return { onImageClick: undefined }
  },

  addAttributes() {
    return {
      url:      { default: '' },
      filename: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-attachment]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-attachment': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})
