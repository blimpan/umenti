# Math Chip Plain Text Serialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix math-only messages being rejected with "content required" by extracting a shared `richContentToText()` utility that serializes TipTap JSON to a plain string (with `$latex$` for math nodes), then using it in `RichInput` and removing the existing duplicate in `FreeTextExercise`.

**Architecture:** A new pure utility `apps/web/src/lib/richContent.ts` walks the TipTap `JSONContent` tree and returns a plain string. `paragraph` nodes append `\n`; `math` atoms wrap their LaTeX in `$...$`; `text` nodes return their text. `RichInput.handleSubmit` replaces `editor.getText()` with this utility so `plainText` is never empty when a math chip is present. `FreeTextExercise` removes its local `richContentToAnswer` and imports the shared utility.

**Tech Stack:** TypeScript, TipTap JSON (`@metis/types`), Vitest

---

### Task 1: Create `richContentToText` utility with tests

**Files:**
- Create: `apps/web/src/lib/richContent.ts`
- Create: `apps/web/src/lib/richContent.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/richContent.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { richContentToText } from './richContent'

describe('richContentToText', () => {
  it('returns empty string for an empty doc', () => {
    expect(richContentToText({ type: 'doc', content: [] })).toBe('')
  })

  it('extracts plain text from a paragraph', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }],
    }
    expect(richContentToText(doc).trim()).toBe('hello')
  })

  it('wraps a math node in $...$', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'math', attrs: { latex: '1+1=2' } }] }],
    }
    expect(richContentToText(doc).trim()).toBe('$1+1=2$')
  })

  it('handles mixed text and math in one paragraph', () => {
    const doc = {
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'The answer is ' },
          { type: 'math', attrs: { latex: 'x=2' } },
        ],
      }],
    }
    expect(richContentToText(doc).trim()).toBe('The answer is $x=2$')
  })

  it('joins multiple paragraphs with newlines', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'line one' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'line two' }] },
      ],
    }
    expect(richContentToText(doc).trim()).toBe('line one\nline two')
  })

  it('returns empty string for math node with no latex attr', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'math', attrs: {} }] }],
    }
    expect(richContentToText(doc).trim()).toBe('$$')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && pnpm vitest run src/lib/richContent.test.ts
```

Expected: FAIL — `richContent` module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/lib/richContent.ts`:

```typescript
import type { RichMessage } from '@metis/types'

type JSONContent = RichMessage['richContent']

/**
 * Walks a TipTap JSONContent tree and serialises it to a plain string.
 * Math chips are rendered as $latex$ (standard inline LaTeX notation).
 * Paragraph nodes append a newline so multi-paragraph messages stay readable.
 */
export function richContentToText(node: JSONContent): string {
  if (node.type === 'math')  return `$${node.attrs?.latex ?? ''}$`
  if (node.type === 'text')  return (node.text as string) ?? ''
  const children = (node.content ?? []).map(richContentToText).join('')
  if (node.type === 'paragraph') return children + '\n'
  return children
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && pnpm vitest run src/lib/richContent.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/richContent.ts apps/web/src/lib/richContent.test.ts
git commit -m "feat: add richContentToText utility for TipTap JSON serialisation"
```

---

### Task 2: Use `richContentToText` in `RichInput.handleSubmit`

**Files:**
- Modify: `apps/web/src/components/input/RichInput.tsx` (lines 131–148)

- [ ] **Step 1: Replace `editor.getText()` and the `hasInlineNode` walk**

In `apps/web/src/components/input/RichInput.tsx`, find `handleSubmit` (around line 131).

Replace:
```typescript
  function handleSubmit() {
    if (!editor || disabled) return

    // Cast to our shared JSONContent type — getJSON() returns a TipTap internal
    // typed variant; our local type is structurally compatible and simpler to work with.
    const richContent = editor.getJSON() as RichMessage['richContent']
    const plainText   = editor.getText()
    let hasInlineNode = false
    editor.state.doc.descendants(node => { if (node.type.name === 'math' || node.type.name === 'attachment') hasInlineNode = true })
    if (!plainText.trim() && !hasInlineNode) return

    const attachments = extractAttachments(richContent)
```

With:
```typescript
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
```

Also add the import at the top of the file alongside the existing `@/lib` imports:
```typescript
import { richContentToText } from '@/lib/richContent'
```

And update the message construction on line ~144 (no `.trim()` needed — already trimmed above):
```typescript
    const message = { richContent, plainText, attachments }
```

- [ ] **Step 2: Verify the app compiles**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/input/RichInput.tsx
git commit -m "fix: derive plainText from richContent so math-only messages pass API validation"
```

---

### Task 3: Remove duplicate in `FreeTextExercise`

**Files:**
- Modify: `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/FreeTextExercise.tsx` (lines 17–25, 62)

- [ ] **Step 1: Add import, remove local function, update call site**

In `FreeTextExercise.tsx`:

1. Add import alongside the existing `@/components/input` imports:
```typescript
import { richContentToText } from '@/lib/richContent'
```

2. Delete the local `richContentToAnswer` function (lines 17–25):
```typescript
/**
 * Walks a TipTap JSON doc and builds a plain string that includes
 * LaTeX from math chips wrapped in $…$ so the backend can grade it.
 */
function richContentToAnswer(node: RichMessage['richContent']): string {
  if (node.type === 'math') return `$${node.attrs?.latex ?? ''}$`
  if (node.type === 'text') return (node.text as string) ?? ''
  return (node.content ?? []).map(richContentToAnswer).join('')
}
```

3. Update the call site in `handleSubmit` (around line 62) from:
```typescript
    const answer = richContentToAnswer(message.richContent).trim() || message.plainText
```
to:
```typescript
    const answer = richContentToText(message.richContent).trim() || message.plainText
```

- [ ] **Step 2: Verify the app compiles**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run all tests**

```bash
cd apps/web && pnpm vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/student/courses/[id]/module/[moduleId]/session/FreeTextExercise.tsx
git commit -m "refactor: replace local richContentToAnswer with shared richContentToText"
```
