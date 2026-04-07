'use client'

import { useCallback, useRef, useState } from 'react'
import { useEditor, useEditorState, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import type { RichMessage, ImageAttachment } from '@metis/types'
import { MathNode } from './extensions/MathNode'
import { ImageNode } from './extensions/ImageNode'
import { MathInputModal } from './MathInputModal'
import { PlusMenu } from './PlusMenu'
import { uploadImage } from '@/lib/uploadImage'
import { richContentToText } from '@/lib/richContent'
import { createClient } from '@/lib/supabase/client'

/** Recursively collect all attachment nodes from a TipTap document tree. */
export function extractAttachments(node: RichMessage['richContent']): ImageAttachment[] {
  const results: ImageAttachment[] = []
  if (node.type === 'attachment' && node.attrs != null) {
    results.push({ url: node.attrs.url as string, filename: node.attrs.filename as string })
  }
  for (const child of node.content ?? []) {
    results.push(...extractAttachments(child))
  }
  return results
}

interface RichInputProps {
  onSubmit: (message: RichMessage) => void
  allowImages?: boolean
  placeholder?: string
  disabled?: boolean
}

interface MathEditState {
  initialLatex: string
  isEditing: boolean
  onInsert: (latex: string) => void
}

export function RichInput({
  onSubmit,
  allowImages = true,
  placeholder = 'Ask a question…',
  disabled = false,
}: RichInputProps) {
  const [mathModal, setMathModal]   = useState<MathEditState | null>(null)
  const [uploading, setUploading]   = useState(false)

  // Save TipTap cursor position before the modal opens (modal steals focus)
  const savedSelectionRef = useRef<number | null>(null)
  // Stable ref to handleSubmit — handleKeyDown is captured at editor init time,
  // so calling handleSubmitRef.current() always reaches the latest closure.
  const handleSubmitRef = useRef<() => void>(() => {})
  // Stable ref to openMathModal — onEditMath is captured at editor init time,
  // same stale-closure problem as handleKeyDown above.
  const openMathModalRef = useRef<(initialLatex?: string, customOnInsert?: (latex: string) => void) => void>(() => {})

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, blockquote: false, codeBlock: false, horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
      MathNode.configure({
        onEditMath: (latex, onInsertCallback) => {
          openMathModalRef.current(latex, onInsertCallback)
        },
      }),
      ImageNode,
    ],
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[56px] px-4 pt-3.5 pb-2 text-sm text-gray-900 leading-relaxed',
      },
      handleKeyDown(view, event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          handleSubmitRef.current()
          return true
        }
        return false
      },
    },
    editable: !disabled,
    immediatelyRender: false,
  })

  function openMathModal(initialLatex = '', customOnInsert?: (latex: string) => void) {
    if (!editor) return
    savedSelectionRef.current = editor.state.selection.anchor
    setMathModal({
      initialLatex,
      isEditing: !!customOnInsert,
      onInsert: customOnInsert ?? insertMathAtSavedPosition,
    })
  }

  const insertMathAtSavedPosition = useCallback((latex: string) => {
    if (!editor) return
    const pos = savedSelectionRef.current
    editor
      .chain()
      .focus()
      .setTextSelection(pos ?? editor.state.doc.content.size)
      .insertContent({ type: 'math', attrs: { latex } })
      .run()
  }, [editor])

  async function handleFileSelected(file: File) {
    if (!editor) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUploading(true)
    try {
      const attachment = await uploadImage(file, user.id)
      editor
        .chain()
        .focus()
        // NOTE: use 'attachment' not 'image' — ImageNode has name: 'attachment'
        .insertContent({ type: 'attachment', attrs: { url: attachment.url, filename: attachment.filename } })
        .run()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleSubmit() {
    if (!editor || disabled) return

    // Cast to our shared JSONContent type — getJSON() returns a TipTap internal
    // typed variant; our local type is structurally compatible and simpler to work with.
    const richContent = editor.getJSON() as RichMessage['richContent']
    const plainText   = richContentToText(richContent).trim()
    let hasAttachment = false
    editor.state.doc.descendants(node => { if (node.type.name === 'attachment') hasAttachment = true })
    if (!plainText && !hasAttachment) return

    const attachments = extractAttachments(richContent)

    const message = { richContent, plainText, attachments }
    console.log('[RichInput] submitting message', message)
    onSubmit(message)
    editor.commands.clearContent()
  }

  // Keep refs in sync with latest closures on every render
  handleSubmitRef.current = handleSubmit
  openMathModalRef.current = openMathModal

  // useEditorState subscribes to editor transactions — required in TipTap v3
  // because editor state is no longer automatically reactive.
  const { isEmpty } = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { isEmpty: true }
      if (e.getText().trim()) return { isEmpty: false }
      let hasInlineNode = false
      e.state.doc.descendants(node => { if (node.type.name === 'math' || node.type.name === 'attachment') hasInlineNode = true })
      return { isEmpty: !hasInlineNode }
    },
  }) ?? { isEmpty: true }

  return (
    <>
      <div
        className={`max-w-2xl mx-auto w-full rounded-[14px] border bg-white shadow-sm transition-shadow ${
          disabled
            ? 'border-gray-200 opacity-60'
            : 'border-gray-200 focus-within:border-teal-600 focus-within:shadow-[0_0_0_3px_rgba(13,148,136,0.08)]'
        }`}
      >
        <EditorContent editor={editor} />

        <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
          <div className="flex items-center gap-2">
            <PlusMenu
              allowImages={allowImages}
              uploading={uploading}
              onInsertMath={() => openMathModal()}
              onFileSelected={handleFileSelected}
            />
            <span className="text-[11px] text-gray-400 hidden sm:inline">
              <kbd className="font-mono bg-gray-100 border border-gray-200 rounded px-1">⇧↵</kbd> for new line
            </span>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isEmpty || disabled}
            className="bg-teal-600 text-white text-sm font-bold px-4 py-1.5 rounded-lg disabled:opacity-40 hover:bg-teal-700 active:bg-teal-800 transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      <MathInputModal
        open={mathModal !== null}
        initialLatex={mathModal?.initialLatex ?? ''}
        isEditing={mathModal?.isEditing ?? false}
        onInsert={latex => mathModal?.onInsert(latex)}
        onClose={() => setMathModal(null)}
      />
    </>
  )
}
