# Math Copy-Paste Design

**Date:** 2026-04-07  
**Status:** Approved

## Problem

When a user copies rendered math from anywhere in the app and pastes it into an input field, the math is lost. What arrives in the clipboard is the unicode rendering (e.g. `a≠0`) instead of the structured LaTeX (`$a \neq 0$`). The result is garbled plain text rather than a renderable math expression.

## Scope

- **In scope:** Math copied from within this app, pasted into either input surface.
- **Out of scope:** Math copied from external sources (PDFs, other websites). Heuristic unicode-to-LaTeX reconstruction is too fragile to include.

## Copy Sources

There are two surfaces that render math in the app:

1. **`MathMarkdown`** — renders markdown+math via KaTeX (`rehype-katex`). Used in theory blocks, exercise questions, session AI messages. KaTeX emits `<annotation encoding="application/x-tex">` inside its MathML output, which carries the original LaTeX source.

2. **TipTap editors** (`RichInput`, `RichMessageRenderer`) — render math as `MathNode` atoms with `node.attrs.latex`. TipTap's default `text/plain` clipboard serialization does not include the LaTeX.

## Paste Targets

1. **`RichInput`** (TipTap) — student learning session. Math should land as a rendered `math` chip (a TipTap `math` node).
2. **`InlineEditField`** (textarea) — teacher Content tab. Stores raw markdown; pasting `$a \neq 0$` is already correct. No changes needed.

## Design

### Three targeted changes — no new files

#### 1. `apps/web/src/components/MathMarkdown.tsx` — copy handler

Wrap the `ReactMarkdown` output in a `<div onCopy={handleCopy}>`.

`handleCopy` logic:
1. Call `window.getSelection()`. If no selection, return without intercepting.
2. Clone the selection range to a `DocumentFragment` via `range.cloneContents()`.
3. Walk the fragment looking for elements with class `katex`. For each one, find the `<annotation encoding="application/x-tex">` descendant and extract its `textContent` (the LaTeX source).
4. If **no** `.katex` elements were found, return without calling `preventDefault` — the browser handles the copy normally.
5. If math was found: replace each `.katex` element in the fragment with a text node of the form `$latex$` (inline) or `$$latex$$` (block, i.e. the `.katex-display` parent is present).
6. Write `fragment.textContent` to `event.clipboardData` as `text/plain`. Call `event.preventDefault()`.

This preserves the surrounding text: "the formula $a \neq 0$ means..." copies as `"the formula $a \neq 0$ means..."`.

#### 2. `apps/web/src/components/input/extensions/MathNode.ts` — clipboard text serializer

Add `addProseMirrorPlugin()` returning a ProseMirror `Plugin` with a `clipboardTextSerializer` prop.

Serializer logic:
1. Check if the `Slice` contains any `math` nodes. If not, return `undefined` to fall back to ProseMirror's default serializer — this ensures normal TipTap copies (bold, lists, paragraphs) are unaffected.
2. If math nodes are present, walk the slice content:
   - Text nodes → append `.text`
   - `math` nodes → append `$${node.attrs.latex}$`
   - Block-level nodes → append `\n` after their content
3. Return the assembled string.

This controls `text/plain` when copying from either `RichInput` or `RichMessageRenderer`.

Note: TipTap's `text/html` clipboard already includes `<span data-math latex="...">` via `MathNode.renderHTML`, so TipTap→TipTap copies across editors already round-trip correctly via the HTML path. The serializer only fixes the `text/plain` representation.

#### 3. `apps/web/src/components/input/RichInput.tsx` — paste handler

Add `handlePaste(view, event, slice)` to `editorProps`.

Logic:
1. Check if `slice` already contains `math` nodes (TipTap parsed them from `text/html`). If yes, return `false` — TipTap handles it natively.
2. Get `text/plain` from `event.clipboardData`. If it contains no `$`, return `false`.
3. Tokenize the string by splitting on `$...$` and `$$...$$ ` patterns (non-greedy regex). Produce an array of `{ type: 'text' | 'math', value: string }` tokens.
4. Discard any math token whose value is empty or looks like a currency amount (e.g. a pure number like `50` with no LaTeX tokens — no backslash, no letter).
5. Build a TipTap `insertContent` call with the token array: text tokens become text nodes, math tokens become `{ type: 'math', attrs: { latex } }` nodes.
6. Return `true`.

## Guard clauses summary

| Risk | Guard |
|------|-------|
| `onCopy` fires on non-math text | Only call `preventDefault` if `.katex` elements were found |
| `clipboardTextSerializer` breaks non-math copies | Return `undefined` if slice has no math nodes |
| `$50` misidentified as math | Discard math tokens that are pure numbers with no LaTeX structure |
| TipTap→TipTap copy intercepted by paste handler | Check for math nodes in the pre-parsed `slice` first; return `false` if found |

## What is not changing

- `InlineEditField` — no paste handler needed; raw markdown `$...$` already renders correctly
- Any route, API, or database layer — purely frontend clipboard behaviour
- `RichMessageRenderer` — benefits from the `MathNode` clipboard text serializer automatically, no direct changes
