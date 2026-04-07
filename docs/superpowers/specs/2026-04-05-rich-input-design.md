# Rich Input Component — Design Spec

**Date:** 2026-04-05  
**Status:** Approved

## Context

Students currently submit answers and questions via plain `<textarea>` elements. Many subjects — particularly math — require expressing structured content: equations, expressions, and diagrams. Images are also needed so students can photograph handwritten work or screenshot graphs.

This spec defines a rich input component that supports **text, inline math expressions, and image attachments** while remaining consistent with the existing session UI and tech stack.

---

## Scope

| Input box | Text | Math | Images |
|---|---|---|---|
| Free-chat box | ✅ | ✅ | ✅ |
| Exercise answer box | ✅ | ✅ | ❌ (future) |

Other input types (code blocks, sketches, tables, file upload) are explicitly out of scope.

---

## Architecture Decision: TipTap for everything

Both input boxes use a single `RichInput` component backed by **TipTap** (a React-friendly wrapper around ProseMirror). Math expressions and image attachments are custom TipTap node extensions.

A plain `<textarea>` cannot embed rich objects at cursor positions — it only holds a flat string. TipTap's document model represents content as a typed node tree, which is what makes inline math chips possible.

The exercise box passes `allowImages={false}` to suppress the image option.

---

## Component API

```tsx
<RichInput
  onSubmit={(payload: RichMessage) => void}
  allowImages?: boolean      // default true; false for exercise boxes
  placeholder?: string
  disabled?: boolean
/>
```

### RichMessage payload

```ts
// packages/types/src/index.ts
import type { JSONContent } from '@tiptap/core'

export type RichMessage = {
  richContent: JSONContent      // full TipTap document tree — stored in DB for faithful re-rendering
  plainText: string             // extracted plain text — used as LLM input string
  attachments: ImageAttachment[]
}

export type ImageAttachment = {
  url: string                   // Supabase Storage public URL
  filename: string
}
```

**Why separate `plainText`:** The LLM receives a clean string, not serialized JSON. The full `JSONContent` tree is stored so messages re-render exactly as written.

---

## TipTap Extensions

### MathNode (inline node)

- **Stored as:** `{ type: 'math', attrs: { latex: 'x^2 + 2x' } }`
- **Renders:** a teal KaTeX chip in the editor
- **Interaction:** click → reopens MathLive modal pre-filled with existing LaTeX
- **Best practice:** store raw LaTeX, not rendered HTML — KaTeX re-renders from source on every mount

### ImageNode (inline node)

- **Stored as:** `{ type: 'image', attrs: { url: '...', filename: 'graph.png' } }`
- **Renders:** a compact filename chip in the editor
- **Best practice:** store a Supabase Storage URL, never base64 — keeps payloads small and passes cleanly to Claude's vision API

---

## The `+` Menu

A Radix `Popover` anchored to a `+` icon button in the input toolbar (Radix is already installed):

```
+ button click →
  ┌─────────────────────┐
  │ ∑  Insert math      │
  │ 🖼  Attach image     │  ← hidden when allowImages={false}
  └─────────────────────┘
```

- **Insert math** → opens `MathInputModal`
- **Attach image** → triggers a hidden `<input type="file" accept="image/*">`, then immediately uploads to Supabase Storage

---

## Math Editor Modal (`MathInputModal`)

A two-tab modal:

- **Visual tab (default):** MathLive `<math-field>` web component — WYSIWYG, no LaTeX knowledge needed
- **LaTeX tab:** plain `<textarea>` with live KaTeX preview side-by-side

Both tabs stay in sync: switching converts between MathLive's internal state and raw LaTeX.

**State management:** MathLive fires an `input` event with the current LaTeX string. This is held in local React state. The TipTap document is only updated on "Insert" — not on every keystroke.

On "Insert": inserts a `MathNode` at the current TipTap cursor position.  
On "Cancel" or close: no document change.

---

## Image Upload Flow

```
Student selects file
  → validate: type must be image/*, size < 5MB
  → upload to Supabase Storage: messages/{userId}/{uuid}.{ext}
  → on success: insert ImageNode at cursor with { url, filename }
  → on failure: show toast error, no node inserted
```

Upload happens **before** Send — no async work at submission time. The `+` button shows a loading spinner while the upload is in progress.

---

## Chat Stream Rendering

After a message is sent, the `ChatMessage` component in the session stream renders:

- **Text + math:** a read-only TipTap instance (`editable={false}`) — `MathNode` renders as inline KaTeX using the existing KaTeX setup. A read-only TipTap instance is preferred over a custom recursive renderer because it reuses the same extension definitions and guarantees consistent output.
- **Image chips:** filename chips in the message bubble; clicking opens a Radix `Dialog` with the full image (lightbox)

---

## Backend Changes

### Prisma schema — no changes needed

`ChatMessage` already has a `payload Json` field that stores a discriminated union per message type. The student message payload simply gains new optional fields:

```ts
// Student message payload shape (extended)
{
  type: 'student_message',
  text: string,               // kept for backwards compatibility with existing messages
  richContent?: JSONContent,  // new: full TipTap document
  plainText?: string,         // new: clean LLM input string
  attachments?: ImageAttachment[]  // new: image URLs
}
```

Old messages (plain text only) continue to render via the `text` field. New messages render via `richContent`.

### API endpoint

`POST /api/sessions/:id/messages` receives `RichMessage`. The handler:

1. Uses `plainText` as the student turn string for the LLM
2. Passes image URLs as `image_url` content blocks in the Claude API request (Claude's vision API natively supports URLs)
3. Stores `richContent`, `plainText`, and `attachments` inside the existing `payload` Json column

---

## New Dependencies

| Package | Purpose |
|---|---|
| `@tiptap/react` | React integration |
| `@tiptap/starter-kit` | Core extensions (text, paragraph, history) |
| `@tiptap/extension-placeholder` | Placeholder text |
| `mathlive` | Visual math editor (MathLive web component) |

KaTeX, remark-math, and rehype-katex are already installed and used for rendering.

---

## Files Modified / Created

### Replaced
- `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx` — the existing `ChatInput` component inside this file is replaced by `<RichInput>`
- `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/FreeTextExercise.tsx` — the exercise `<textarea>` is replaced by `<RichInput allowImages={false}>`

### New files
| File | Purpose |
|---|---|
| `apps/web/src/components/input/RichInput.tsx` | Main TipTap-backed component |
| `apps/web/src/components/input/MathInputModal.tsx` | MathLive modal |
| `apps/web/src/components/input/PlusMenu.tsx` | Popover attachment menu |
| `apps/web/src/components/input/extensions/MathNode.ts` | TipTap MathNode extension |
| `apps/web/src/components/input/extensions/ImageNode.ts` | TipTap ImageNode extension |
| `apps/web/src/lib/uploadImage.ts` | Supabase Storage upload helper |

### Modified
| File | Change |
|---|---|
| `packages/types/src/index.ts` | Add `RichMessage`, `ImageAttachment` types |
| `apps/api/src/routes/student.ts` (or sessions route) | Accept `RichMessage`, pass image URLs to Claude |

---

## Verification

1. **Math input:** open the chat box, click `+` → Insert math, type an expression in visual mode, toggle to LaTeX and back — both should stay in sync. Click Insert — chip appears inline in the text.
2. **Math editing:** click an existing math chip — modal reopens pre-filled.
3. **Image upload:** click `+` → Attach image, select a file — chip appears after upload. Hover shows filename. Click in the chat stream → lightbox opens.
4. **Exercise box:** `allowImages={false}` — the `+` menu should only show Insert math, no image option.
5. **Submission payload:** check the network request on Send — `plainText` should be a clean string, `attachments` should contain the Supabase URL, `content` should be valid TipTap JSON.
6. **LLM context:** verify that Claude receives image URLs as `image_url` content blocks, not embedded in the text string.
