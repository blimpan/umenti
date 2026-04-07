# Rich Input Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain textarea in the student chat and exercise boxes with a TipTap-backed rich input that supports inline math expressions (MathLive) and image attachments (Supabase Storage).

**Architecture:** A single `RichInput` component wraps a TipTap editor instance with two custom node extensions: `MathNode` (stores raw LaTeX, renders via `katex.render()` into a ref) and `ImageNode` (stores a Supabase Storage URL, renders as a filename chip). A `+` menu (Radix Popover) exposes "Insert math" and "Attach image". On submit, the component emits a `RichMessage` payload containing the TipTap document tree, extracted plain text, and image attachment URLs.

**Tech Stack:** TipTap v2 (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`), MathLive (`mathlive`), KaTeX (already installed), Radix UI Popover + Dialog (already installed), Supabase Storage (new bucket), Next.js 14, TypeScript.

---

## Pre-flight: Supabase Storage bucket (manual step)

Before starting Task 1, create the storage bucket in the Supabase dashboard:

1. Go to **Storage** → **New bucket**
2. Name: `message-attachments`
3. Set to **Public** (images need a public URL to pass to Claude's vision API)
4. Add an RLS INSERT policy: authenticated users can upload only under their own user ID folder — condition: `(storage.foldername(name))[1] = auth.uid()::text`

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `packages/types/src/index.ts` | Modify | Add `RichMessage`, `ImageAttachment` types |
| `apps/web/src/lib/uploadImage.ts` | Create | Validate + upload file to Supabase Storage, return URL |
| `apps/web/src/components/input/extensions/MathNode.ts` | Create | TipTap inline node: stores LaTeX, renders KaTeX via ref |
| `apps/web/src/components/input/extensions/MathNodeView.tsx` | Create | React node view for MathNode |
| `apps/web/src/components/input/extensions/ImageNode.ts` | Create | TipTap inline node: stores URL+filename, renders chip |
| `apps/web/src/components/input/extensions/ImageNodeView.tsx` | Create | React node view for ImageNode |
| `apps/web/src/components/input/MathChip.tsx` | Create | KaTeX chip using `katex.render()` into a ref (no innerHTML) |
| `apps/web/src/components/input/PlusMenu.tsx` | Create | Radix Popover with Insert Math / Attach Image actions |
| `apps/web/src/components/input/MathInputModal.tsx` | Create | MathLive visual editor + LaTeX tab modal |
| `apps/web/src/components/input/RichInput.tsx` | Create | Main TipTap component wiring all the above |
| `apps/web/src/components/input/RichMessageRenderer.tsx` | Create | Read-only TipTap view with image lightbox |
| `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx` | Modify | Replace `ChatInput` with `RichInput` |
| `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/FreeTextExercise.tsx` | Modify | Replace textarea with `RichInput allowImages={false}` |
| `apps/api/src/routes/session.ts` | Modify | Accept RichMessage payload, pass image URLs to Claude |

---

## Task 1: Install dependencies

**Files:** `apps/web/package.json`, `packages/types/package.json`

- [ ] **Step 1: Install TipTap and MathLive in the web app**

```bash
cd apps/web && pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder mathlive
```

Expected: packages added to `apps/web/package.json` without errors.

- [ ] **Step 2: Install `@tiptap/core` in the types package (needed for the `JSONContent` type)**

```bash
cd packages/types && pnpm add @tiptap/core
```

- [ ] **Step 3: Verify installs compile**

```bash
cd /Users/linus/Coding/metis && pnpm tsc --noEmit -p apps/web/tsconfig.json
```

Expected: exits 0 (or only pre-existing errors — no new ones from the installs).

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json packages/types/package.json pnpm-lock.yaml
git commit -m "chore: add TipTap and MathLive dependencies"
```

---

## Task 2: Shared types

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Add `RichMessage` and `ImageAttachment` to the shared types**

Open `packages/types/src/index.ts` and add at the end of the file:

```ts
import type { JSONContent } from '@tiptap/core'

export type ImageAttachment = {
  url: string       // Supabase Storage public URL
  filename: string
}

export type RichMessage = {
  richContent: JSONContent     // TipTap document tree — for DB storage and re-rendering
  plainText: string            // extracted plain text — used as LLM input
  attachments: ImageAttachment[]
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd packages/types && pnpm tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat: add RichMessage and ImageAttachment shared types"
```

---

## Task 3: Image upload helper

**Files:**
- Create: `apps/web/src/lib/uploadImage.ts`

- [ ] **Step 1: Create the upload helper**

Create `apps/web/src/lib/uploadImage.ts`:

```ts
import { createClient } from '@/lib/supabase/client'
import type { ImageAttachment } from '@metis/types'

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const BUCKET = 'message-attachments'

export class UploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UploadError'
  }
}

export async function uploadImage(
  file: File,
  userId: string,
): Promise<ImageAttachment> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new UploadError('File must be an image (JPEG, PNG, GIF, or WebP)')
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new UploadError('Image must be smaller than 5 MB')
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const uuid = crypto.randomUUID()
  const path = `${userId}/${uuid}.${ext}`

  const supabase = createClient()
  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) throw new UploadError(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, filename: file.name }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/uploadImage.ts
git commit -m "feat: add Supabase Storage image upload helper"
```

---

## Task 4: MathChip — shared KaTeX chip

Both the TipTap editor node view and the read-only chat stream need a consistent rendered chip. Build it once, reuse everywhere.

**Key design choice:** Use `katex.render(latex, domNode)` into a ref instead of `dangerouslySetInnerHTML`. This keeps the KaTeX output inside a controlled DOM node and avoids any HTML string handling.

**Files:**
- Create: `apps/web/src/components/input/MathChip.tsx`

- [ ] **Step 1: Create MathChip**

Create `apps/web/src/components/input/MathChip.tsx`:

```tsx
'use client'

import katex from 'katex'
import 'katex/dist/katex.min.css'
import { useEffect, useRef } from 'react'

interface MathChipProps {
  latex: string
  /** Shown in the TipTap editor — opens the edit modal on click */
  onClick?: () => void
  /** Shown in the TipTap editor — removes the node */
  onRemove?: () => void
}

export function MathChip({ latex, onClick, onRemove }: MathChipProps) {
  const mathRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!mathRef.current) return
    katex.render(latex || '\\square', mathRef.current, {
      throwOnError: false,
      displayMode:  false,
    })
  }, [latex])

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 bg-teal-50 border border-teal-200 rounded px-1.5 py-px text-teal-800 text-sm align-middle ${onClick ? 'cursor-pointer hover:bg-teal-100' : ''}`}
    >
      <span ref={mathRef} />
      {onRemove && (
        <button
          onMouseDown={e => { e.preventDefault(); onRemove() }}
          className="text-teal-300 hover:text-teal-500 leading-none ml-0.5 text-xs"
          aria-label="Remove math expression"
        >
          ×
        </button>
      )}
    </span>
  )
}
```

Note: `onMouseDown` with `e.preventDefault()` on the remove button prevents TipTap from losing focus when the button is clicked.

- [ ] **Step 2: Verify compilation**

```bash
cd apps/web && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/input/MathChip.tsx
git commit -m "feat: add MathChip component using katex.render into ref"
```

---

## Task 5: TipTap extensions

**Files:**
- Create: `apps/web/src/components/input/extensions/MathNode.ts`
- Create: `apps/web/src/components/input/extensions/MathNodeView.tsx`
- Create: `apps/web/src/components/input/extensions/ImageNode.ts`
- Create: `apps/web/src/components/input/extensions/ImageNodeView.tsx`

- [ ] **Step 1: Create MathNode extension**

Create `apps/web/src/components/input/extensions/MathNode.ts`:

```ts
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

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView)
  },
})
```

- [ ] **Step 2: Create MathNodeView**

Create `apps/web/src/components/input/extensions/MathNodeView.tsx`:

```tsx
'use client'

import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { MathChip } from '../MathChip'
import type { MathNodeOptions } from './MathNode'

export function MathNodeView({ node, deleteNode, updateAttributes, extension }: NodeViewProps) {
  const latex = node.attrs.latex as string
  const { onEditMath } = (extension as any).options as MathNodeOptions

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
```

- [ ] **Step 3: Create ImageNode extension**

Create `apps/web/src/components/input/extensions/ImageNode.ts`:

```ts
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageNodeView } from './ImageNodeView'

export interface ImageNodeOptions {
  onImageClick?: (url: string) => void
}

export const ImageNode = Node.create<ImageNodeOptions>({
  name: 'image',
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
    return [{ tag: 'span[data-image]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-image': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})
```

- [ ] **Step 4: Create ImageNodeView**

Create `apps/web/src/components/input/extensions/ImageNodeView.tsx`:

```tsx
'use client'

import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import type { ImageNodeOptions } from './ImageNode'

export function ImageNodeView({ node, deleteNode, extension }: NodeViewProps) {
  const { url, filename } = node.attrs as { url: string; filename: string }
  const { onImageClick } = (extension as any).options as ImageNodeOptions
  const isReadOnly = !!onImageClick  // lightbox mode = read-only (no remove button)

  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <span
        onClick={() => onImageClick?.(url)}
        className={`inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2 py-0.5 text-xs text-gray-700 align-middle ${isReadOnly ? 'cursor-pointer hover:bg-gray-50' : ''}`}
      >
        {/* Tiny preview thumbnail */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="w-4 h-4 rounded object-cover" />
        <span className="max-w-[120px] truncate">{filename}</span>
        {!isReadOnly && (
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
```

- [ ] **Step 5: Verify compilation**

```bash
cd apps/web && pnpm tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/input/extensions/
git commit -m "feat: add MathNode and ImageNode TipTap extensions"
```

---

## Task 6: MathInputModal

**Files:**
- Create: `apps/web/src/types/mathlive.d.ts`
- Create: `apps/web/src/components/input/MathInputModal.tsx`

- [ ] **Step 1: Add MathLive type declaration**

MathLive registers a `<math-field>` web component. TypeScript needs a declaration. Create `apps/web/src/types/mathlive.d.ts`:

```ts
// Type declaration for the MathLive <math-field> web component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { value?: string; 'virtual-keyboard-mode'?: string },
        HTMLElement
      >
    }
  }
}

export {}
```

- [ ] **Step 2: Create the modal**

Create `apps/web/src/components/input/MathInputModal.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { MathChip } from './MathChip'

interface MathInputModalProps {
  open: boolean
  initialLatex?: string
  onInsert: (latex: string) => void
  onClose: () => void
}

type Tab = 'visual' | 'latex'

export function MathInputModal({ open, initialLatex = '', onInsert, onClose }: MathInputModalProps) {
  const [tab, setTab]     = useState<Tab>('visual')
  const [latex, setLatex] = useState(initialLatex)
  const mathFieldRef      = useRef<HTMLElement & { value?: string }>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setLatex(initialLatex)
      setTab('visual')
    }
  }, [open, initialLatex])

  // Load MathLive dynamically (web component; must run client-side only)
  useEffect(() => {
    import('mathlive').catch(() => console.warn('MathLive failed to load'))
  }, [])

  // Keep local latex state in sync with the MathLive field
  useEffect(() => {
    const el = mathFieldRef.current
    if (!el || tab !== 'visual') return

    if (el.value !== latex) el.value = latex

    function handleInput(e: Event) {
      setLatex((e.target as HTMLElement & { value?: string }).value ?? '')
    }
    el.addEventListener('input', handleInput)
    return () => el.removeEventListener('input', handleInput)
  }, [tab, latex])

  function handleInsert() {
    const trimmed = latex.trim()
    if (!trimmed) return
    onInsert(trimmed)
    onClose()
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/30 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-xl shadow-xl w-[480px] max-w-[95vw] overflow-hidden">
          <Dialog.Title className="sr-only">Insert math expression</Dialog.Title>

          {/* Tab bar */}
          <div className="flex border-b border-gray-100">
            {(['visual', 'latex'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'border-b-2 border-teal-600 text-teal-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'visual' ? 'Visual editor' : 'LaTeX'}
              </button>
            ))}
          </div>

          <div className="p-5">
            {tab === 'visual' ? (
              <div>
                {/* @ts-ignore — declared in mathlive.d.ts */}
                <math-field
                  ref={mathFieldRef}
                  class="w-full min-h-[60px] border border-gray-200 rounded-lg p-3 text-lg focus:outline-none focus:border-teal-400"
                  virtual-keyboard-mode="manual"
                >
                  {latex}
                </math-field>
                <p className="mt-2 text-xs text-gray-400">
                  Type LaTeX directly, or use the on-screen keyboard.
                </p>
              </div>
            ) : (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 block mb-1">LaTeX</label>
                  <textarea
                    value={latex}
                    onChange={e => setLatex(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-3 font-mono text-sm resize-none outline-none focus:border-teal-400"
                    rows={4}
                    placeholder="x^2 + 2x - 3"
                    autoFocus
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 block mb-1">Preview</label>
                  <div className="border border-gray-200 rounded-lg p-3 min-h-[96px] flex items-center justify-center bg-gray-50">
                    {latex.trim()
                      ? <MathChip latex={latex} />
                      : <span className="text-xs text-gray-400">Preview appears here</span>
                    }
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleInsert}
                disabled={!latex.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-40"
              >
                Insert
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd apps/web && pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/input/MathInputModal.tsx apps/web/src/types/mathlive.d.ts
git commit -m "feat: add MathInputModal with MathLive visual editor and LaTeX preview"
```

---

## Task 7: PlusMenu

**Files:**
- Create: `apps/web/src/components/input/PlusMenu.tsx`

- [ ] **Step 1: Create PlusMenu**

Create `apps/web/src/components/input/PlusMenu.tsx`:

```tsx
'use client'

import * as Popover from '@radix-ui/react-popover'
import { ImageIcon, PlusIcon, SigmaIcon } from 'lucide-react'
import { useRef } from 'react'

interface PlusMenuProps {
  allowImages: boolean
  uploading: boolean
  onInsertMath: () => void
  onFileSelected: (file: File) => void
}

export function PlusMenu({ allowImages, uploading, onInsertMath, onFileSelected }: PlusMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleImageClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelected(file)
    e.target.value = ''  // reset so the same file can be re-selected
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden
      />
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={uploading}
            aria-label="Insert math or attach image"
            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-teal-500 rounded-full animate-spin" />
            ) : (
              <PlusIcon size={14} />
            )}
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={6}
            className="z-50 bg-white border border-gray-200 rounded-lg shadow-md py-1 min-w-[190px]"
          >
            <Popover.Close asChild>
              <button
                onClick={onInsertMath}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <SigmaIcon size={14} className="text-teal-600" />
                Insert math expression
              </button>
            </Popover.Close>

            {allowImages && (
              <Popover.Close asChild>
                <button
                  onClick={handleImageClick}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <ImageIcon size={14} className="text-teal-600" />
                  Attach image
                </button>
              </Popover.Close>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  )
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd apps/web && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/input/PlusMenu.tsx
git commit -m "feat: add PlusMenu popover for math and image insertion"
```

---

## Task 8: RichInput — core component

**Files:**
- Create: `apps/web/src/components/input/RichInput.tsx`
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Create RichInput**

Create `apps/web/src/components/input/RichInput.tsx`:

```tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import type { RichMessage } from '@metis/types'
import { MathNode } from './extensions/MathNode'
import { ImageNode } from './extensions/ImageNode'
import { MathInputModal } from './MathInputModal'
import { PlusMenu } from './PlusMenu'
import { uploadImage } from '@/lib/uploadImage'
import { createClient } from '@/lib/supabase/client'

interface RichInputProps {
  onSubmit: (message: RichMessage) => void
  allowImages?: boolean
  placeholder?: string
  disabled?: boolean
}

interface MathEditState {
  initialLatex: string
  /** Called with the final LaTeX when the user clicks Insert */
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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, blockquote: false, codeBlock: false, horizontalRule: false,
      }),
      Placeholder.configure({ placeholder }),
      MathNode.configure({
        onEditMath: (latex, onInsertCallback) => {
          openMathModal(latex, onInsertCallback)
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
          handleSubmit()
          return true
        }
        return false
      },
    },
    editable: !disabled,
  })

  function openMathModal(initialLatex = '', customOnInsert?: (latex: string) => void) {
    if (!editor) return
    // Save cursor position as a document offset
    savedSelectionRef.current = editor.state.selection.anchor
    setMathModal({
      initialLatex,
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
        .insertContent({ type: 'image', attrs: { url: attachment.url, filename: attachment.filename } })
        .run()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleSubmit() {
    if (!editor || disabled) return

    const richContent = editor.getJSON()
    const plainText   = editor.getText()
    if (!plainText.trim()) return

    // Collect image attachments by traversing the document nodes
    const attachments = (richContent.content ?? [])
      .flatMap(node => [node, ...(node.content ?? [])])
      .filter(node => node.type === 'image')
      .map(node => ({
        url:      node.attrs!.url as string,
        filename: node.attrs!.filename as string,
      }))

    onSubmit({ richContent, plainText: plainText.trim(), attachments })
    editor.commands.clearContent()
  }

  const isEmpty = !editor?.getText().trim()

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
        onInsert={latex => mathModal?.onInsert(latex)}
        onClose={() => setMathModal(null)}
      />
    </>
  )
}
```

- [ ] **Step 2: Add TipTap Placeholder CSS**

In `apps/web/src/app/globals.css`, add at the end:

```css
/* TipTap placeholder */
.tiptap p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #9ca3af;
  pointer-events: none;
  height: 0;
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd apps/web && pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/input/RichInput.tsx apps/web/src/app/globals.css
git commit -m "feat: add RichInput TipTap component with math chips and image attachments"
```

---

## Task 9: Wire RichInput into the session UI

**Files:**
- Modify: `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx`
- Modify: `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/FreeTextExercise.tsx`

- [ ] **Step 1: Replace ChatInput in SessionShell**

In `SessionShell.tsx`:

**a) Add imports** at the top:
```tsx
import { RichInput } from '@/components/input/RichInput'
import type { RichMessage } from '@metis/types'
```

**b) Delete the entire `ChatInput` component** — the `interface ChatInputProps` block and the `function ChatInput(...)` function.

**c) Update `handleSend`** — find the function that currently takes `(content: string)` and calls the API. Replace its signature and body:

```tsx
async function handleSend(message: RichMessage) {
  // Keep `content` field for backend history-building backwards compat
  const body = {
    content:     message.plainText,
    richContent: message.richContent,
    attachments: message.attachments,
  }
  // Replace the existing fetch call's body with `JSON.stringify(body)`
  // Everything else (SSE handling, state updates) stays the same
}
```

**d) Replace `<ChatInput ... />` with:**
```tsx
<RichInput
  onSubmit={handleSend}
  disabled={inputDisabled}
  placeholder={inputPlaceholder ?? undefined}
/>
```

Remove the `inputRef` prop — `RichInput` manages focus internally.

- [ ] **Step 2: Replace the exercise textarea in FreeTextExercise**

In `FreeTextExercise.tsx`:

**a) Add imports**:
```tsx
import { RichInput } from '@/components/input/RichInput'
import type { RichMessage } from '@metis/types'
```

**b) Update `handleSubmit`** to accept a `RichMessage`:
```tsx
function handleSubmit(message: RichMessage) {
  if (submitted || pending || disabled) return
  setPending(true)
  onSubmit(exercise.id, message.plainText)  // existing prop signature unchanged
}
```

**c) Replace the `<textarea>` block** (textarea + submit button) with:
```tsx
<RichInput
  onSubmit={handleSubmit}
  allowImages={false}
  disabled={submitted || pending || disabled}
  placeholder="Write your answer…"
/>
```

**d) Remove** the `answer` and `setAnswer` state — they're no longer needed.

- [ ] **Step 3: Verify compilation**

```bash
cd apps/web && pnpm tsc --noEmit
```

- [ ] **Step 4: Manual smoke test**

```bash
pnpm dev
```

1. Open a student session. Type text in the chat box → press Enter. Confirm the message sends.
2. Click `+` → Insert math → type `\frac{1}{2}` → Insert. Confirm chip appears inline in the text.
3. Click the math chip → modal reopens prefilled with `\frac{1}{2}`.
4. Click `+` → Attach image → select a file. Confirm chip appears.
5. Hit Send. Confirm no console errors.
6. Open an exercise card. Confirm the `+` menu shows only "Insert math" — no image option.
7. Submit an exercise answer with a math chip → confirm no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx \
        apps/web/src/app/student/courses/[id]/module/[moduleId]/session/FreeTextExercise.tsx
git commit -m "feat: replace textarea inputs with RichInput in session UI"
```

---

## Task 10: Chat stream rendering

**Files:**
- Create: `apps/web/src/components/input/RichMessageRenderer.tsx`
- Modify: `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx`

- [ ] **Step 1: Create RichMessageRenderer**

Create `apps/web/src/components/input/RichMessageRenderer.tsx`:

```tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { MathNode } from './extensions/MathNode'
import { ImageNode } from './extensions/ImageNode'
import type { JSONContent } from '@tiptap/core'
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'

interface RichMessageRendererProps {
  richContent: JSONContent
}

export function RichMessageRenderer({ richContent }: RichMessageRendererProps) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      // Read-only math: no onEditMath callback
      MathNode.configure({ onEditMath: undefined }),
      // Read-only images: onImageClick opens the lightbox
      ImageNode.configure({ onImageClick: url => setLightboxUrl(url) }),
    ],
    content:  richContent,
    editable: false,
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightboxUrl}
                alt="Attached image"
                className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
```

- [ ] **Step 2: Wire into the student message bubble in SessionShell**

In `SessionShell.tsx`, add import:
```tsx
import { RichMessageRenderer } from '@/components/input/RichMessageRenderer'
```

Find the student message rendering (a branch where `message.role === 'STUDENT'`). Update it to use `RichMessageRenderer` when `richContent` is present:

```tsx
// Inside the student message bubble:
{(message.payload as any).richContent ? (
  <RichMessageRenderer richContent={(message.payload as any).richContent} />
) : (
  <span>{(message.payload as any).content}</span>
)}
```

- [ ] **Step 3: Verify compilation**

```bash
cd apps/web && pnpm tsc --noEmit
```

- [ ] **Step 4: Manual test**

1. Send a message with a math chip → confirm it renders as KaTeX in the stream.
2. Send a message with an image chip → confirm chip appears. Click it → lightbox opens with full image.
3. Send a plain-text message (no chips) → confirm it still renders correctly (backwards-compat branch).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/input/RichMessageRenderer.tsx \
        apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx
git commit -m "feat: render rich messages with math and image lightbox in chat stream"
```

---

## Task 11: Backend — handle RichMessage and pass images to Claude

**Files:**
- Modify: `apps/api/src/routes/session.ts`

- [ ] **Step 1: Update the request body destructuring**

In `session.ts`, find `router.post('/messages', ...)`. The current destructuring is:

```ts
const { content } = req.body as { content: string }
```

Replace with:

```ts
const {
  content,
  richContent,
  attachments = [],
} = req.body as {
  content:      string
  richContent?: unknown
  attachments?: Array<{ url: string; filename: string }>
}
```

- [ ] **Step 2: Store richContent and attachments in the student message payload**

Find the `prisma.chatMessage.create` call for the student message. The current `payload` is `{ content }`. Update to:

```ts
payload: {
  content,
  ...(richContent  && { richContent }),
  ...(attachments.length && { attachments }),
},
```

- [ ] **Step 3: Pass image URLs as Claude vision content blocks**

Find the `recentChat` mapping. Currently each message maps to `{ role, content: string }`. Update to produce multi-part content for messages with attachments:

```ts
const recentChat = [...existingHistory, { role: 'STUDENT', type: 'TEXT', payload: { content, attachments } }]
  .filter(m => m.role !== 'SYSTEM' && m.type === 'TEXT')
  .slice(-20)
  .map(m => {
    const p   = m.payload as { content: string; attachments?: Array<{ url: string }> }
    const role = (m.role === 'AI' ? 'assistant' : 'user') as 'assistant' | 'user'

    if (p.attachments?.length) {
      return {
        role,
        content: [
          { type: 'text' as const, text: p.content },
          ...p.attachments.map(a => ({
            type:  'image' as const,
            image: a.url,   // Vercel AI SDK accepts URL strings for image content blocks
          })),
        ],
      }
    }

    return { role, content: p.content }
  })
```

- [ ] **Step 4: Verify API compiles**

```bash
cd apps/api && pnpm tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 5: Integration test**

1. Restart the API: `cd apps/api && pnpm dev`
2. In the student session, send a message with an attached image.
3. Open Supabase Table Editor → `ChatMessage` table → confirm the latest row's `payload` JSON contains `richContent` and `attachments`.
4. Confirm the AI response in the session references or responds to the image (ask "what is in this image?").

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/session.ts
git commit -m "feat: accept RichMessage payload and pass image URLs to Claude vision API"
```

---

## Final Verification Checklist

- [ ] Chat box: type text + insert math chip (`\frac{1}{2}`) + attach image → Send → message renders correctly in stream
- [ ] Math chip in stream: renders as KaTeX (not raw LaTeX text)
- [ ] Image chip in stream: click → lightbox opens
- [ ] Click math chip in editor → modal reopens prefilled → edit → Insert → chip updates
- [ ] Exercise box: `+` menu shows only "Insert math" — no "Attach image"
- [ ] Submit exercise with math chip → grading endpoint still receives clean `plainText`
- [ ] Old plain-text messages (no `richContent`) still render correctly
- [ ] Network request body: contains `content` (plainText), `richContent` (JSON), `attachments` (URL array)
- [ ] Supabase Storage: uploaded file appears in `message-attachments/{userId}/`
- [ ] No TypeScript errors: `pnpm tsc --noEmit` passes in both `apps/web` and `apps/api`
