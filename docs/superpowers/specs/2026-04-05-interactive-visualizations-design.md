# Interactive Visualizations — Design Spec

**Date:** 2026-04-05  
**Status:** Approved

## Context

Metis currently supports two exercise types (MC and free-text) and plain Markdown theory blocks. This spec adds:

1. **Exploratory visualizations** embedded in theory blocks — students interact freely to build intuition, no grading.
2. **Interactive exercises** (`INTERACTIVE` type) — a graded exercise where the student must reach a target state in a visualization to demonstrate understanding.

The goal is the same wow-factor as Claude Artifacts / ChatGPT interactive diagrams, integrated natively into the learning session flow. Primary subject: math (for demo). Architecture supports any subject long-term.

---

## Approach: LLM-generated HTML/JS artifacts

The LLM generates self-contained HTML+JS for each visualization at **course-creation time**. The HTML is stored in the database and rendered at session time inside a sandboxed iframe. This is the same approach used by Claude Artifacts.

Visualizations are generated during the existing course generation pipeline — no new generation latency during the student session.

---

## Security model

The iframe uses `sandbox="allow-scripts"` **without** `allow-same-origin`. This is the critical flag:

- Without `allow-same-origin`, the sandboxed document has a null origin even when loaded via `srcdoc`, preventing it from accessing parent cookies, localStorage, or DOM.
- `allow-scripts` is required for interactivity.
- No `allow-forms`, no `allow-top-navigation`.

Communication from iframe → parent is exclusively via `window.parent.postMessage({ type: 'viz-state', data: {...} }, '*')`.

Parent validates the source: `if (e.source !== iframeRef.current?.contentWindow) return`.

CDN scripts whitelisted: `cdnjs.cloudflare.com` only. No `fetch()`, no `XMLHttpRequest`, no external images.

### Grading security

`targetState` is **never sent to the client** — it stays server-side, consistent with how `correctIndex` and `sampleAnswer` are stripped from `StudentExercise`. The frontend submits the current viz state to the server; the server performs the comparison and returns `correct: boolean`.

---

## Database changes

```prisma
enum ExerciseType {
  MULTIPLE_CHOICE
  FREE_TEXT
  INTERACTIVE   // new
}

model TheoryBlock {
  // existing fields...
  visualization String?  // nullable; LLM-generated HTML blob
}

model Exercise {
  // existing fields...
  visualizationHtml String?  // used when type = INTERACTIVE
  targetState       Json?    // server-only; never sent to client
}
```

Migration: additive only — all new fields are nullable, no breaking changes to existing rows.

---

## Type changes (`packages/types/src/index.ts`)

```ts
// Add to ExerciseType enum:
INTERACTIVE = 'INTERACTIVE'

// StudentExercise gets (targetState intentionally excluded):
visualizationHtml?: string

// TheoryBlock (student-facing) gets:
visualization?: string
```

`targetState` is excluded from `StudentExercise` the same way `correctIndex` is — server strips it before sending.

---

## Course generation pipeline

### Pass 2 — Theory blocks + optional visualization

After generating theory text for a concept, the LLM also decides whether a visualization adds pedagogical value and, if so, generates one.

Structured output schema:
```ts
z.object({
  shouldVisualize: z.boolean(),
  visualizationHtml: z.string().optional(),
})
```

The LLM decides — not every concept warrants a visualization. "Slope of a linear function" almost certainly does; "definition of a variable" probably doesn't.

Retry logic: if `shouldVisualize: true` but `visualizationHtml` is missing or fails a basic sanity check (non-empty, contains `<`), retry once (consistent with existing math validation retry pattern).

### Pass 3 — Exercises including INTERACTIVE type

The LLM can now emit any of three exercise types. INTERACTIVE exercise schema:

```ts
z.object({
  type: z.literal('INTERACTIVE'),
  question: z.string(),
  visualizationHtml: z.string(),
  targetState: z.record(z.unknown()),
  explanation: z.string().optional(),
})
```

A concept can mix types — e.g. one MC + one INTERACTIVE is valid.

### HTML generation contract (injected into Pass 2 & Pass 3 prompts)

```
VISUALIZATION CONTRACT — follow exactly:
- Output a complete, self-contained HTML document (<!DOCTYPE html>...)
- All CSS and JS must be inline — no external stylesheets
- CDN scripts: load only from https://cdnjs.cloudflare.com/
  Recommended: Plotly.js (interactive charts), Math.js (expression parsing), D3.js (custom viz)
- On every user interaction, emit current state:
    window.parent.postMessage({ type: 'viz-state', data: { key: value, ... } }, '*')
- Emit state once on load with initial values
- Do NOT use: fetch(), XMLHttpRequest, localStorage, sessionStorage, cookies, external images
- Visual style: white background (#ffffff), dark text (#111827), accent color #6366f1
- Size: fit within 320px height, no internal scrollbars, responsive width
```

For INTERACTIVE exercises, the prompt additionally specifies:
```
- The exercise question is: {question}
- The student must reach this target state: {targetState JSON}
- Include a clear visual indicator (color, label, or annotation) showing the target value(s)
- Include a proximity indicator when the student is within ~10% of the target
- These indicators are for student guidance only — grading is handled server-side
```

---

## Frontend components

### `VisualizationFrame` (new, shared)

```
apps/web/src/components/VisualizationFrame.tsx
```

Props:
```ts
{
  html: string
  onStateChange?: (state: Record<string, unknown>) => void
  height?: number  // default 320
}
```

Renders a sandboxed iframe via `srcdoc`. Listens for `viz-state` postMessages and forwards them to `onStateChange`. Validates message source against `iframeRef.current.contentWindow`.

### `InteractiveExercise` (new)

```
apps/web/src/app/student/courses/[id]/InteractiveExercise.tsx
```

Uses `VisualizationFrame`. Tracks current viz state via `onStateChange`. Renders an explicit **Submit** button (consistent with `FreeTextExercise`) — the student interacts with the viz, then clicks Submit when ready. On submit, calls `POST /api/exercises/:id/submit` with `{ vizState: currentState }`. Displays correct/incorrect feedback identically to existing MC/FT exercises (reuses existing feedback UI).

**Does not** perform local targetState comparison — the server is authoritative. The viz HTML itself includes a proximity indicator (generated via the LLM contract) so the student can self-assess, but the grading result comes from the server.

### Modified: `TheoryBlock` renderer

If `visualization` is present on the message payload, render `<VisualizationFrame html={visualization} />` below the theory text. No `onStateChange` needed (exploratory only).

### Modified: `ExerciseCard` dispatcher

Add case:
```ts
case 'INTERACTIVE':
  return <InteractiveExercise exercise={exercise} onResult={onResult} />
```

### Modified: `courseGeneration.ts`

- Pass 2: after `generateTheoryBlocks()`, add `generateVisualization()` call per concept; save result to `TheoryBlock.visualization`.
- Pass 3: extend exercise generation Zod schema to include the `INTERACTIVE` union; persist `visualizationHtml` and `targetState` to the `Exercise` row.

---

## API changes

### `POST /api/exercises/:id/submit`

Extended to handle `INTERACTIVE` type:

```ts
// Request body for INTERACTIVE:
{ vizState: Record<string, unknown> }

// Grading:
const exercise = await prisma.exercise.findUnique(...)
const correct = compareStates(exercise.targetState, body.vizState)

function compareStates(target, actual, epsilon = 0.05): boolean {
  return Object.entries(target).every(([key, expected]) => {
    if (key.startsWith('_')) return true  // skip metadata keys like _tolerance
    const actual_val = actual[key]
    if (typeof expected === 'number') {
      const tol = target._tolerance?.[key] ?? epsilon
      return Math.abs(Number(actual_val) - expected) <= tol
    }
    return actual_val === expected
  })
}
```

Returns same `ExerciseResult` shape as existing types: `{ correct, scoreChange, feedback }`.

---

## Verification

1. Run course generation on a math course — confirm theory blocks get `visualization` HTML for appropriate concepts, and at least one INTERACTIVE exercise is generated.
2. In the student session, confirm theory blocks with visualizations render the iframe; confirm student can interact with it freely without it affecting concept progress.
3. Submit an INTERACTIVE exercise with the correct viz state — confirm `correct: true` and score advances.
4. Submit with incorrect state — confirm `correct: false`, score does not advance.
5. Attempt to spoof by sending a crafted POST body with `vizState` matching targetState while the iframe shows a different state — confirm server validates correctly regardless (server is authoritative).
6. Inspect network requests from within the sandboxed iframe — confirm no external requests are made; confirm parent cookies are inaccessible.
