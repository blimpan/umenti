'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { MathNode } from './extensions/MathNode'
import { ImageNode } from './extensions/ImageNode'
import { useState } from 'react'
import { Dialog } from 'radix-ui'
import type { RichMessage } from '@metis/types'

interface RichMessageRendererProps {
  richContent: RichMessage['richContent']
}

export function RichMessageRenderer({ richContent }: RichMessageRendererProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      // Read-only math: no onEditMath callback (no edit interaction)
      MathNode.configure({ onEditMath: undefined }),
      // Read-only images: onImageClick opens the lightbox
      ImageNode.configure({ onImageClick: url => setLightboxUrl(url) }),
    ],
    content:  richContent as any,  // TipTap content accepts JSONContent
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'outline-none text-sm leading-relaxed' },
    },
  })

  return (
    <>
      <EditorContent editor={editor} />

      <Dialog.Root open={!!lightboxUrl} onOpenChange={v => !v && setLightboxUrl(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 max-w-[90vw] max-h-[90vh] focus:outline-none">
            <Dialog.Title className="sr-only">Attached image</Dialog.Title>
            {lightboxUrl && (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lightboxUrl}
                  alt="Attached image"
                  className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                />
                <Dialog.Close
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                  aria-label="Close image"
                >
                  ×
                </Dialog.Close>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
