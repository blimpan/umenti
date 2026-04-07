# Math Copy-Paste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When math is copied from anywhere in the app and pasted into an input field, it arrives as structured LaTeX (`$a \neq 0$` in `InlineEditField`, or a rendered math chip in `RichInput`).

**Architecture:** Four targeted changes — a new pure-utility file (`mathPaste.ts`) provides testable functions for tokenising `$...$` strings and rewriting copied DOM fragments; `MathMarkdown.tsx` adds an `onCopy` handler that extracts LaTeX from KaTeX's embedded `<annotation>` elements; `MathNode.ts` adds a `renderText` field (TipTap v3's native API) so the editor's clipboard text serializer outputs `$latex$`; and `RichInput.tsx` adds a `handlePaste` handler that converts incoming `$...$` plain text into TipTap math nodes.

**Tech Stack:** TipTap v3.22, ProseMirror (via `@tiptap/pm`), KaTeX / rehype-katex, Vitest 4.1, jsdom

---

## File Map

| File | Status | Responsibility |
|------|--------|----------------|
| `apps/web/src/lib/mathPaste.ts` | **Create** | Pure utilities: `tokenizeMathText`, `rewriteFragmentForCopy` |
| `apps/web/src/lib/mathPaste.test.ts` | **Create** | Unit tests for both utilities |
| `apps/web/src/components/MathMarkdown.tsx` | **Modify** | Add `'use client'` + `onCopy` handler |
| `apps/web/src/components/input/extensions/MathNode.ts` | **Modify** | Add `renderText` field |
| `apps/web/src/components/input/RichInput.tsx` | **Modify** | Add `handlePasteRef` + `handleMathPaste` + `handlePaste` in `editorProps` |

---

## Task 1: `tokenizeMathText` — split `$...$` strings into token arrays

**Files:**
- Create: `apps/web/src/lib/mathPaste.ts`
- Create: `apps/web/src/lib/mathPaste.test.ts`

This pure function is the core logic for the paste handler. It turns a string like `"with $a \neq 0$ here"` into `[{type:'text',value:'with '}, {type:'math',latex:'a \\neq 0'}, {type:'text',value:' here'}]`. No DOM, no TipTap — fully unit-testable.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/mathPaste.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { tokenizeMathText } from './mathPaste'

describe('tokenizeMathText', () => {
  it('returns a single text token for plain text with no math', () => {
    expect(tokenizeMathText('hello world')).toEqual([
      { type: 'text', value: 'hello world' },
    ])
  })

  it('returns a single math token for a bare $...$', () => {
    expect(tokenizeMathText('$a + b$')).toEqual([
      { type: 'math', latex: 'a + b' },
    ])
  })

  it('handles inline math surrounded by text', () => {
    expect(tokenizeMathText('with $a \\neq 0$ here')).toEqual([
      { type: 'text', value: 'with ' },
      { type: 'math', latex: 'a \\neq 0' },
      { type: 'text', value: ' here' },
    ])
  })

  it('handles multiple math expressions', () => {
    expect(tokenizeMathText('$a$ and $b$')).toEqual([
      { type: 'math', latex: 'a' },
      { type: 'text', value: ' and ' },
      { type: 'math', latex: 'b' },
    ])
  })

  it('handles $$...$$ block math', () => {
    expect(tokenizeMathText('$$\\frac{x}{2}$$')).toEqual([
      { type: 'math', latex: '\\frac{x}{2}' },
    ])
  })

  it('leaves pure-number $...$ as plain text (currency guard)', () => {
    expect(tokenizeMathText('costs $50$ to buy')).toEqual([
      { type: 'text', value: 'costs $50$ to buy' },
    ])
  })

  it('returns empty array for empty string', () => {
    expect(tokenizeMathText('')).toEqual([])
  })

  it('trims whitespace from extracted latex', () => {
    expect(tokenizeMathText('$  x + 1  $')).toEqual([
      { type: 'math', latex: 'x + 1' },
    ])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/web && node_modules/.bin/vitest run src/lib/mathPaste.test.ts
```

Expected: `FAIL` with "Cannot find module './mathPaste'"

- [ ] **Step 3: Implement `tokenizeMathText`**

Create `apps/web/src/lib/mathPaste.ts`:

```ts
export type MathToken =
  | { type: 'text'; value: string }
  | { type: 'math'; latex: string }

/**
 * Tokenises a string containing $...$ and $$...$$ math expressions into
 * alternating text and math segments.
 *
 * Pure numbers wrapped in dollars (e.g. "$50$") are treated as plain text to
 * avoid misidentifying currency amounts as math.
 */
export function tokenizeMathText(text: string): MathToken[] {
  // $$...$$ must come before $...$ in the alternation so block math is not
  // consumed as two separate inline tokens.
  const re = /\$\$([^$]+)\$\$|\$([^$\n]+)\$/g
  const tokens: MathToken[] = []
  let last = 0

  for (const match of text.matchAll(re)) {
    const latex = (match[1] ?? match[2]).trim()
    // Skip pure-number matches — these are likely currency amounts like $50$
    if (/^[\d.,]+$/.test(latex)) continue

    if (match.index! > last) {
      tokens.push({ type: 'text', value: text.slice(last, match.index) })
    }
    tokens.push({ type: 'math', latex })
    last = match.index! + match[0].length
  }

  if (last < text.length) {
    tokens.push({ type: 'text', value: text.slice(last) })
  }

  return tokens
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/web && node_modules/.bin/vitest run src/lib/mathPaste.test.ts
```

Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/mathPaste.ts apps/web/src/lib/mathPaste.test.ts
git commit -m "feat: add tokenizeMathText utility for math paste"
```

---

## Task 2: `rewriteFragmentForCopy` — rewrite a copied DOM fragment's math to LaTeX

**Files:**
- Modify: `apps/web/src/lib/mathPaste.ts`
- Modify: `apps/web/src/lib/mathPaste.test.ts`

KaTeX always emits `<annotation encoding="application/x-tex">` inside its MathML output. This function walks a `DocumentFragment` (the cloned DOM selection), finds each `.katex` span, extracts the LaTeX from that annotation, and replaces the whole span with `$latex$` text. Returns `null` if no math was found (meaning the caller should not intercept the copy).

Test helper uses `document.createRange().createContextualFragment(html)` — the jsdom-safe way to build a `DocumentFragment` from a string without assigning to `innerHTML` directly.

- [ ] **Step 1: Add failing tests**

Append to `apps/web/src/lib/mathPaste.test.ts`:

```ts
import { rewriteFragmentForCopy } from './mathPaste'

/** Build a DocumentFragment from an HTML string using Range. */
function makeFragment(html: string): DocumentFragment {
  return document.createRange().createContextualFragment(html)
}

describe('rewriteFragmentForCopy', () => {
  it('returns null when no .katex elements are present', () => {
    expect(rewriteFragmentForCopy(makeFragment('<p>plain text</p>'))).toBeNull()
  })

  it('replaces an inline .katex span with $latex$', () => {
    const fragment = makeFragment(
      'before <span class="katex">' +
        '<math><semantics>' +
          '<annotation encoding="application/x-tex">a \\neq 0</annotation>' +
        '</semantics></math>' +
      '</span> after'
    )
    expect(rewriteFragmentForCopy(fragment)).toBe('before $a \\neq 0$ after')
  })

  it('uses $$latex$$ for display math (.katex inside .katex-display)', () => {
    const fragment = makeFragment(
      '<span class="katex-display">' +
        '<span class="katex">' +
          '<math><semantics>' +
            '<annotation encoding="application/x-tex">\\frac{x}{2}</annotation>' +
          '</semantics></math>' +
        '</span>' +
      '</span>'
    )
    expect(rewriteFragmentForCopy(fragment)).toBe('$$\\frac{x}{2}$$')
  })

  it('handles multiple math spans in one selection', () => {
    const fragment = makeFragment(
      'x = <span class="katex"><math><semantics>' +
        '<annotation encoding="application/x-tex">a</annotation>' +
      '</semantics></math></span>' +
      ' and y = <span class="katex"><math><semantics>' +
        '<annotation encoding="application/x-tex">b</annotation>' +
      '</semantics></math></span>'
    )
    expect(rewriteFragmentForCopy(fragment)).toBe('x = $a$ and y = $b$')
  })

  it('returns null when .katex has no annotation element', () => {
    expect(
      rewriteFragmentForCopy(makeFragment('<span class="katex">rendered</span>'))
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/web && node_modules/.bin/vitest run src/lib/mathPaste.test.ts
```

Expected: `FAIL` with "rewriteFragmentForCopy is not a function"

- [ ] **Step 3: Implement `rewriteFragmentForCopy`**

Add to `apps/web/src/lib/mathPaste.ts` (below `tokenizeMathText`):

```ts
/**
 * Rewrites a DocumentFragment that may contain KaTeX-rendered math by
 * replacing each .katex span with its LaTeX source as $latex$ or $$latex$$.
 *
 * Returns the resulting textContent, or null if no math was found or replaced
 * (so the caller knows not to intercept the copy event).
 *
 * Browser-only — relies on the global `document` to create text nodes.
 */
export function rewriteFragmentForCopy(fragment: DocumentFragment): string | null {
  const katexSpans = Array.from(fragment.querySelectorAll('.katex'))
  if (katexSpans.length === 0) return null

  let replaced = 0
  for (const span of katexSpans) {
    const annotation = span.querySelector('annotation[encoding="application/x-tex"]')
    if (!annotation) continue
    const latex = (annotation.textContent ?? '').trim()
    const isDisplay = span.closest('.katex-display') !== null
    const textNode = document.createTextNode(isDisplay ? `$$${latex}$$` : `$${latex}$`)
    span.parentNode!.replaceChild(textNode, span)
    replaced++
  }

  return replaced > 0 ? fragment.textContent : null
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/web && node_modules/.bin/vitest run src/lib/mathPaste.test.ts
```

Expected: `13 passed`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/mathPaste.ts apps/web/src/lib/mathPaste.test.ts
git commit -m "feat: add rewriteFragmentForCopy for KaTeX copy interception"
```

---

## Task 3: `MathMarkdown` — intercept copy to emit `$latex$` plain text

**Files:**
- Modify: `apps/web/src/components/MathMarkdown.tsx`

`MathMarkdown` is currently a server-compatible component. Adding an `onCopy` event handler requires `'use client'`. The component is always rendered inside client components (`InlineEditField`, `FreeTextExercise`, `SessionShell`, etc.), so this change is safe.

The handler wraps the `ReactMarkdown` output in a `<div>`. When the user copies, it clones the selection into a fragment, rewrites it, and if math was found, replaces the clipboard text.

No automated test — `window.getSelection()` is not reliable in jsdom. Verify manually after implementing.

- [ ] **Step 1: Replace `MathMarkdown.tsx`**

Full new content of `apps/web/src/components/MathMarkdown.tsx`:

```tsx
'use client'

import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { rewriteFragmentForCopy } from '@/lib/mathPaste'

interface Props {
  children: string
}

/**
 * Renders markdown with KaTeX math support.
 * Inline math: $...$  Block math: $$...$$  Currency: \$
 *
 * Intercepts copy events so that selecting rendered math and copying it puts
 * the LaTeX source ($latex$) on the clipboard instead of the unicode glyphs.
 */
export default function MathMarkdown({ children }: Props) {
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
    <div onCopy={handleCopy}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual test**

1. Open a course in the teacher Content tab. Find a theory block with math (or edit one to include `$a \neq 0$` and save, then click away to exit edit mode).
2. Select the rendered math text ("a ≠ 0") with your mouse.
3. Copy with Cmd+C.
4. Open a plain text editor (e.g., VS Code) and paste.

Expected: pasted text is `$a \neq 0$`, not `a≠0`.

Also confirm: selecting and copying plain text (no math) from a `MathMarkdown` block still works normally.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/MathMarkdown.tsx
git commit -m "feat: intercept copy in MathMarkdown to emit LaTeX source"
```

---

## Task 4: `MathNode` — add `renderText` for TipTap clipboard serialization

**Files:**
- Modify: `apps/web/src/components/input/extensions/MathNode.ts`

TipTap v3's built-in `ClipboardTextSerializer` extension calls `renderText` on each node type when building `text/plain` clipboard content. Adding this single field to `MathNode` means that copying from any TipTap editor (`RichInput`, `RichMessageRenderer`) automatically includes `$latex$` in the plain text.

- [ ] **Step 1: Add `renderText` to `MathNode.ts`**

Full new content of `apps/web/src/components/input/extensions/MathNode.ts`:

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

  // TipTap v3: controls what text/plain contains when this node is copied.
  // Without this, copying a math chip produces empty text.
  renderText({ node }) {
    return `$${node.attrs.latex as string}$`
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView)
  },
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/web && node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual test**

1. Open the student learning session for any course.
2. In the AI response, find a rendered math chip, or type an answer with math in `RichInput`.
3. Select text that includes a math chip.
4. Copy with Cmd+C and paste into a plain text editor.

Expected: the chip appears as `$latex$` in the pasted text.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/input/extensions/MathNode.ts
git commit -m "feat: add renderText to MathNode for TipTap clipboard text serialization"
```

---

## Task 5: `RichInput` — paste handler for `$...$` → math chips

**Files:**
- Modify: `apps/web/src/components/input/RichInput.tsx`

When text containing `$...$` is pasted into `RichInput`, this handler intercepts it and converts math tokens into TipTap math nodes (rendered chips). It only activates when the pre-parsed TipTap clipboard slice doesn't already contain math nodes (covering TipTap→TipTap copies, which work natively via `text/html`).

Follows the same `*Ref` pattern already used in `RichInput` for `handleSubmitRef` and `openMathModalRef`, since `editorProps` callbacks are captured at editor init time.

- [ ] **Step 1: Add import**

In `apps/web/src/components/input/RichInput.tsx`, add this import after the existing imports:

```ts
import { tokenizeMathText } from '@/lib/mathPaste'
```

- [ ] **Step 2: Add `handlePasteRef`**

After the `openMathModalRef` declaration, add:

```ts
const handlePasteRef = useRef<(text: string) => void>(() => {})
```

- [ ] **Step 3: Add `handleMathPaste` function**

After the `openMathModal` function, add:

```ts
function handleMathPaste(text: string) {
  if (!editor) return
  const tokens = tokenizeMathText(text)
  if (!tokens.some(t => t.type === 'math')) return
  editor
    .chain()
    .focus()
    .insertContent(
      tokens.map(token =>
        token.type === 'math'
          ? { type: 'math', attrs: { latex: token.latex } }
          : { type: 'text', text: token.value }
      )
    )
    .run()
}
```

- [ ] **Step 4: Add `handlePaste` inside `editorProps`**

Inside the `useEditor` call, in the `editorProps` object, add `handlePaste` after `handleKeyDown`:

```ts
handlePaste(_view, event, slice) {
  // If TipTap's HTML parser already found math nodes (TipTap-to-TipTap copy),
  // let TipTap handle it natively via the text/html clipboard path.
  let hasMathNodes = false
  slice.content.descendants(node => {
    if (node.type.name === 'math') { hasMathNodes = true }
  })
  if (hasMathNodes) return false

  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text.includes('$')) return false

  handlePasteRef.current(text)
  return true
},
```

- [ ] **Step 5: Keep `handlePasteRef` in sync**

In the "Keep refs in sync" block at the bottom of the component body (where `handleSubmitRef.current` and `openMathModalRef.current` are assigned), add:

```ts
handlePasteRef.current = handleMathPaste
```

The block should now read:

```ts
// Keep refs in sync with latest closures on every render
handleSubmitRef.current  = handleSubmit
openMathModalRef.current = openMathModal
handlePasteRef.current   = handleMathPaste
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd apps/web && node_modules/.bin/tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Run existing RichInput tests to confirm no regressions**

```bash
cd apps/web && node_modules/.bin/vitest run src/components/input/RichInput.test.tsx
```

Expected: all existing tests pass.

- [ ] **Step 8: Manual test — paste from MathMarkdown into RichInput**

1. In the teacher Content tab, find a theory block with rendered math.
2. Select and copy the math (Cmd+C).
3. Navigate to the student learning session.
4. Click the answer input and paste (Cmd+V).

Expected: math lands as a teal chip, not garbled text.

- [ ] **Step 9: Manual test — paste raw LaTeX text into RichInput**

1. In the teacher Content tab, click a theory block to enter edit mode (shows raw markdown).
2. Select and copy text that includes `$a \neq 0$`.
3. Paste into the `RichInput` in the student session.

Expected: the `$a \neq 0$` portion becomes a math chip; surrounding plain text stays as text.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/input/RichInput.tsx
git commit -m "feat: add math paste handler to RichInput — converts \$latex\$ text to chips"
```
