# Interactive Visualizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add LLM-generated sandboxed HTML/JS visualizations to theory blocks (exploratory) and as a new `INTERACTIVE` exercise type (graded via server-side state comparison).

**Architecture:** The LLM generates self-contained HTML+JS during course generation (Pass 2 for theory viz, Pass 3 for exercises). HTML is stored in the DB and rendered at session time via a sandboxed `srcdoc` iframe (`sandbox="allow-scripts"` without `allow-same-origin`). For `INTERACTIVE` exercises, the student submits their current viz state and the server compares it against the stored `targetState`.

**Tech Stack:** Prisma (schema + migration), Vitest (unit tests), React (new components: `VisualizationFrame`, `InteractiveExercise`), Zod (updated generation schemas), Vercel AI SDK (`generateText` with `Output.object`)

> **Minor spec deviation:** `visualization` is stored on `Concept` (not `TheoryBlock`) since it is semantically one visualization per concept — simpler querying and cleaner than scanning all theory blocks.

---

### File map

| Action | File |
|--------|------|
| Modify | `apps/api/prisma/schema.prisma` |
| Create | `apps/api/prisma/migrations/<timestamp>_add_interactive_viz/` (auto-generated) |
| Modify | `packages/types/src/index.ts` |
| Create | `apps/web/src/components/VisualizationFrame.tsx` |
| Create | `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/InteractiveExercise.tsx` |
| Modify | `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/ExerciseCard.tsx` |
| Modify | `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx` |
| Create | `apps/api/src/lib/vizGrading.ts` |
| Create | `apps/api/src/lib/vizGrading.test.ts` |
| Modify | `apps/api/src/routes/session.ts` |
| Modify | `apps/api/src/services/courseGeneration.ts` |

---

### Task 1: Schema migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Run: `pnpm --filter api exec prisma migrate dev --name add_interactive_viz`

- [ ] **Step 1: Update schema.prisma**

Replace the `ExerciseType` enum and add fields to `Concept` and `Exercise`:

```prisma
// In schema.prisma — replace existing ExerciseType enum:
enum ExerciseType {
  MULTIPLE_CHOICE
  FREE_TEXT
  INTERACTIVE
}

// In the Concept model — add after `name String`:
visualization String?   // optional LLM-generated HTML; one per concept

// In the Exercise model — add after `rubric String?`:
visualizationHtml String?   // used when type = INTERACTIVE
targetState       Json?      // server-only; never sent to client
```

- [ ] **Step 2: Run migration**

```bash
cd apps/api && pnpm exec prisma migrate dev --name add_interactive_viz
```

Expected output: `The following migration(s) have been applied: .../add_interactive_viz/migration.sql`

- [ ] **Step 3: Regenerate Prisma client**

```bash
cd apps/api && pnpm exec prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add INTERACTIVE exercise type and visualization fields to schema"
```

---

### Task 2: Shared types

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Update CourseExercise type**

Find the `CourseExercise` type (currently line ~94) and update `type` and add new fields:

```ts
export type CourseExercise = {
  id: number
  type: 'MULTIPLE_CHOICE' | 'FREE_TEXT' | 'INTERACTIVE'
  question: string
  order: number
  pendingRevision: boolean
  conceptIds: number[]
  // MULTIPLE_CHOICE
  options: string[] | null
  correctIndex: number | null
  explanation: string | null
  // FREE_TEXT
  sampleAnswer: string | null
  rubric: string | null
  // INTERACTIVE (targetState intentionally excluded — server-only)
  visualizationHtml: string | null
}
```

- [ ] **Step 2: Update CourseConcept type**

Find the `CourseConcept` type (currently line ~87) and add `visualization`:

```ts
export type CourseConcept = {
  id: number
  name: string
  order: number
  theoryBlocks: CourseTheoryBlock[]
  visualization?: string   // optional LLM-generated HTML for exploratory viz
}
```

- [ ] **Step 3: Update StudentExercise — keep targetState excluded**

`StudentExercise` is currently `Omit<CourseExercise, 'correctIndex' | 'sampleAnswer' | 'rubric'>`. `targetState` was never on `CourseExercise` so nothing to change here — `visualizationHtml` will flow through automatically.

- [ ] **Step 4: Update THEORY_BLOCK payload to carry visualization**

In the `ChatMessage` discriminated union, update the `THEORY_BLOCK` variant:

```ts
| { type: 'THEORY_BLOCK'; payload: { conceptId: number; blocks: string[]; visualization?: string } }
```

In the `SseEvent` union, update `system:theory_block`:

```ts
| { type: 'system:theory_block'; payload: { conceptId: number; blocks: string[]; visualization?: string } }
```

- [ ] **Step 5: Typecheck**

```bash
cd packages/types && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat: add INTERACTIVE type, visualization fields to shared types"
```

---

### Task 3: VisualizationFrame component

**Files:**
- Create: `apps/web/src/components/VisualizationFrame.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useRef, useEffect } from 'react'

interface Props {
  html: string
  onStateChange?: (state: Record<string, unknown>) => void
  height?: number
}

// Renders LLM-generated HTML inside a sandboxed iframe.
// sandbox="allow-scripts" without allow-same-origin gives the iframe a null origin
// so it cannot read parent cookies, DOM, or localStorage — even with srcdoc.
// Communication from iframe → parent is via window.parent.postMessage only.
export default function VisualizationFrame({ html, onStateChange, height = 320 }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      // Only accept messages from this specific iframe
      if (e.source !== iframeRef.current?.contentWindow) return
      if (e.data?.type === 'viz-state' && onStateChange) {
        onStateChange(e.data.data as Record<string, unknown>)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onStateChange])

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      sandbox="allow-scripts"
      className="w-full rounded-lg border border-gray-200"
      style={{ height }}
      title="Interactive visualization"
    />
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/VisualizationFrame.tsx
git commit -m "feat: add VisualizationFrame sandboxed iframe component"
```

---

### Task 4: vizGrading helper with tests

**Files:**
- Create: `apps/api/src/lib/vizGrading.ts`
- Create: `apps/api/src/lib/vizGrading.test.ts`

- [ ] **Step 1: Write the failing tests first**

```ts
// apps/api/src/lib/vizGrading.test.ts
import { describe, it, expect } from 'vitest'
import { compareVizStates } from './vizGrading'

describe('compareVizStates', () => {
  it('returns true when numeric values match within default epsilon', () => {
    expect(compareVizStates({ slope: 2, intercept: -3 }, { slope: 2.03, intercept: -3.01 })).toBe(true)
  })

  it('returns false when a numeric value is outside epsilon', () => {
    expect(compareVizStates({ slope: 2 }, { slope: 2.1 })).toBe(false)
  })

  it('returns true for exact string match', () => {
    expect(compareVizStates({ shape: 'circle' }, { shape: 'circle' })).toBe(true)
  })

  it('returns false for string mismatch', () => {
    expect(compareVizStates({ shape: 'circle' }, { shape: 'square' })).toBe(false)
  })

  it('returns true when all keys match with per-key tolerance override', () => {
    // _tolerance._keys is a metadata key — should be skipped in comparison
    expect(compareVizStates(
      { slope: 2, _tolerance: { slope: 0.2 } },
      { slope: 2.15 }
    )).toBe(true)
  })

  it('returns false when actual is missing a required key', () => {
    expect(compareVizStates({ slope: 2, intercept: -3 }, { slope: 2 })).toBe(false)
  })

  it('returns true for empty target (trivially satisfied)', () => {
    expect(compareVizStates({}, { anything: 'here' })).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && pnpm test src/lib/vizGrading.test.ts
```

Expected: FAIL — `Cannot find module './vizGrading'`

- [ ] **Step 3: Implement vizGrading.ts**

```ts
// apps/api/src/lib/vizGrading.ts

const DEFAULT_EPSILON = 0.05

/**
 * Compares a student's current visualization state against the stored target.
 * Numeric values are compared with a tolerance (default ±0.05).
 * Keys starting with '_' are metadata and are skipped.
 *
 * @param target  - The stored correct state (from Exercise.targetState)
 * @param actual  - The state submitted by the student
 * @param epsilon - Default numeric tolerance when no per-key override is set
 */
export function compareVizStates(
  target: Record<string, unknown>,
  actual: Record<string, unknown>,
  epsilon = DEFAULT_EPSILON,
): boolean {
  const toleranceOverrides = (target._tolerance ?? {}) as Record<string, number>

  return Object.entries(target).every(([key, expected]) => {
    if (key.startsWith('_')) return true   // skip metadata keys

    const actualVal = actual[key]

    if (typeof expected === 'number') {
      const tol = toleranceOverrides[key] ?? epsilon
      return typeof actualVal === 'number' && Math.abs(actualVal - expected) <= tol
    }

    return actualVal === expected
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/api && pnpm test src/lib/vizGrading.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/vizGrading.ts apps/api/src/lib/vizGrading.test.ts
git commit -m "feat: add compareVizStates helper for INTERACTIVE exercise grading"
```

---

### Task 5: API — expose visualization fields + INTERACTIVE grading

**Files:**
- Modify: `apps/api/src/routes/session.ts`
- Modify: `apps/api/src/routes/student.ts`

- [ ] **Step 1: Update `toStudentExercise` in session.ts**

The function at line ~36 needs to add `visualizationHtml` (but NOT `targetState`). Replace the function:

```ts
function toStudentExercise(ex: {
  id: number
  type: any
  question: string
  order: number
  pendingRevision: boolean
  options: any
  explanation: string | null
  visualizationHtml: string | null
  conceptLinks: { conceptId: number }[]
}): StudentExercise {
  return {
    id: ex.id,
    type: ex.type,
    question: ex.question,
    order: ex.order,
    pendingRevision: ex.pendingRevision,
    conceptIds: ex.conceptLinks.map(cl => cl.conceptId),
    options: ex.options as string[] | null,
    explanation: ex.explanation,
    visualizationHtml: ex.visualizationHtml,
  }
}
```

- [ ] **Step 2: Update `system:theory_block` emit in the advance endpoint**

In `POST /advance` (around line ~285), find the theory block emit and add `visualization`:

```ts
// Replace the two lines that build blocks and emit theory:
const blocks = cl.concept.theoryBlocks.map(tb => tb.content)
const viz = cl.concept.visualization ?? undefined
const order = orderCounter++
await prisma.chatMessage.create({
  data: {
    sessionId: session.id, role: 'SYSTEM', type: 'THEORY_BLOCK',
    payload: { conceptId: cl.conceptId, blocks, visualization: viz },
    order,
  },
})
sseEmit(res, { type: 'system:theory_block', payload: { conceptId: cl.conceptId, blocks, visualization: viz } })
```

Apply the same change in `POST /exercises/:exerciseId/submit` around line ~540 where `THEORY_BLOCK` is pushed to `pendingEvents`:

```ts
// Replace the existing theory block pendingEvents push:
if (!theoryConceptsInHistory.has(cl.conceptId)) {
  const blocks = cl.concept.theoryBlocks.map(tb => tb.content)
  const viz = cl.concept.visualization ?? undefined
  pendingEvents.push({
    sseType: 'system:theory_block',
    msgType: 'THEORY_BLOCK',
    payload: { conceptId: cl.conceptId, blocks, visualization: viz },
  })
}
```

- [ ] **Step 3: Add INTERACTIVE grading to the submit endpoint**

Add import at top of session.ts:

```ts
import { compareVizStates } from '../lib/vizGrading'
```

In `POST /exercises/:exerciseId/submit`, find the grading block (around line ~375) and add the INTERACTIVE branch:

```ts
// Replace the existing grading block:
let correct: boolean
let savedGrading: { scoreChange: number; correct: boolean; almost: boolean } | null = null

if (exercise.type === 'MULTIPLE_CHOICE') {
  const selectedIndex = typeof answer === 'number' ? answer : parseInt(String(answer))
  correct = selectedIndex === exercise.correctIndex
} else if (exercise.type === 'INTERACTIVE') {
  const { vizState } = req.body as { vizState?: Record<string, unknown> }
  if (!vizState || typeof vizState !== 'object') {
    res.status(400).json({ error: 'vizState required for INTERACTIVE exercises' }); return
  }
  const target = exercise.targetState as Record<string, unknown> | null
  correct = target ? compareVizStates(target, vizState) : false
} else {
  savedGrading = await gradeFreeText(
    exercise.question,
    exercise.sampleAnswer ?? '',
    exercise.rubric ?? '',
    String(answer),
  )
  if (!savedGrading) {
    sseOpen(res)
    sseEmit(res, { type: 'system:message', payload: { content: 'Grading failed — please try again.' } })
    sseEmit(res, { type: 'done' })
    res.end()
    return
  }
  correct = savedGrading.correct
}
```

Also update the `scoreChange` block (around line ~405) to handle INTERACTIVE (same as MC):

```ts
scoreChange = exercise.type === 'MULTIPLE_CHOICE' || exercise.type === 'INTERACTIVE'
  ? (correct ? 20 : -10)
  : (savedGrading?.scoreChange ?? 0)
feedback = exercise.type === 'MULTIPLE_CHOICE' || exercise.type === 'INTERACTIVE'
  ? (exercise.explanation ?? '')
  : 'Answer submitted.'
```

For the AI feedback, the `answer` variable is used in the prompt. For INTERACTIVE, stringify the vizState. Add before the streamText call (~line 621):

```ts
const answerForFeedback = exercise.type === 'INTERACTIVE'
  ? JSON.stringify((req.body as any).vizState ?? {})
  : String(answer)
```

And update the message:
```ts
{ role: 'user', content: `My answer was: ${answerForFeedback}` },
```

- [ ] **Step 4: Update student.ts GET module endpoint to expose visualization**

In `student.ts` around line ~227, the concepts are mapped. Add `visualization` to the concept shape and `visualizationHtml` to exercises:

```ts
concepts: rawModule.conceptLinks.map(cl => ({
  id: cl.conceptId,
  name: cl.concept.name,
  order: cl.order,
  visualization: cl.concept.visualization ?? undefined,   // ← add this
  theoryBlocks: cl.concept.theoryBlocks.map(tb => ({
    id: tb.id,
    order: tb.order,
    pendingRevision: tb.pendingRevision,
    content: tb.content,
  })),
})),
// correctIndex, sampleAnswer, rubric, targetState intentionally omitted
exercises: rawModule.exercises.map(ex => ({
  id: ex.id,
  order: ex.order,
  pendingRevision: ex.pendingRevision,
  type: ex.type,
  question: ex.question,
  conceptIds: ex.conceptLinks.map(cl => cl.conceptId),
  options: ex.options as string[] | null,
  explanation: ex.explanation,
  visualizationHtml: ex.visualizationHtml ?? null,   // ← add this
})),
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/session.ts apps/api/src/routes/student.ts
git commit -m "feat: expose visualization fields in API, add INTERACTIVE grading to submit endpoint"
```

---

### Task 6: InteractiveExercise component

**Files:**
- Create: `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/InteractiveExercise.tsx`

- [ ] **Step 1: Create the component**

Model closely after `FreeTextExercise.tsx` (same card styling, same Submit button, same result pill).

```tsx
'use client'

import { useState, useCallback } from 'react'
import { StudentExercise, ExerciseResult } from '@metis/types'
import MathMarkdown from '@/components/MathMarkdown'
import VisualizationFrame from '@/components/VisualizationFrame'

interface Props {
  exercise: StudentExercise
  result?: ExerciseResult
  onSubmit: (exerciseId: number, vizState: Record<string, unknown>) => void
  disabled?: boolean
}

export default function InteractiveExercise({ exercise, result, onSubmit, disabled }: Props) {
  // Track current iframe state so we can submit it on button click
  const [currentState, setCurrentState] = useState<Record<string, unknown>>({})
  const [pending, setPending] = useState(false)

  const submitted = !!result
  const isCorrect = result?.correct ?? false
  const isAlmost  = !isCorrect && (result?.almost ?? false)

  const handleStateChange = useCallback((state: Record<string, unknown>) => {
    setCurrentState(state)
  }, [])

  function handleSubmit() {
    if (submitted || pending || disabled) return
    setPending(true)
    onSubmit(exercise.id, currentState)
  }

  const cardClass = submitted
    ? 'border border-gray-200'
    : pending
    ? 'border card-evaluating'
    : 'border border-gray-200 shadow-md'

  const pillClass = isCorrect
    ? 'bg-green-100 text-green-700'
    : isAlmost
    ? 'bg-yellow-100 text-yellow-700'
    : 'bg-red-100 text-red-700'

  const resultLabel = !submitted ? '' : isCorrect ? 'Correct' : isAlmost ? 'Not quite' : 'Incorrect'

  return (
    <div className={`rounded-xl bg-white transition-colors overflow-hidden ${cardClass}`}>
      <div className="px-4 py-4">
        <div className="text-sm font-semibold text-gray-900 leading-snug mb-4 prose prose-sm max-w-none">
          <MathMarkdown>{exercise.question}</MathMarkdown>
        </div>

        {exercise.visualizationHtml && (
          <div className="mb-4">
            <VisualizationFrame
              html={exercise.visualizationHtml}
              onStateChange={handleStateChange}
            />
          </div>
        )}

        {!submitted ? (
          <div className="mt-3">
            <button
              onClick={handleSubmit}
              disabled={pending || disabled}
              className="bg-teal-600 text-white text-sm font-bold px-5 py-2 rounded-lg disabled:opacity-40 hover:bg-teal-700 active:bg-teal-800 transition-colors flex items-center gap-2"
            >
              {pending ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
                    <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Checking…
                </>
              ) : 'Submit'}
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${pillClass}`}>
              {isCorrect ? '✓' : isAlmost ? '≈' : '✗'} {resultLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/student/courses/[id]/module/[moduleId]/session/InteractiveExercise.tsx
git commit -m "feat: add InteractiveExercise component with sandboxed iframe and submit button"
```

---

### Task 7: Wire up ExerciseCard + TheoryBlock rendering

**Files:**
- Modify: `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/ExerciseCard.tsx`
- Modify: `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx`

- [ ] **Step 1: Add INTERACTIVE case to ExerciseCard**

The `onSubmit` prop currently takes `(exerciseId: number, answer: string | number)`. For INTERACTIVE it needs to send a `vizState`. The cleanest approach is to make the answer type `string | number | Record<string, unknown>` and let SessionShell handle routing:

```tsx
'use client'

import { StudentExercise, ExerciseResult } from '@metis/types'
import MultipleChoiceExercise from './MultipleChoiceExercise'
import FreeTextExercise from './FreeTextExercise'
import InteractiveExercise from './InteractiveExercise'

interface Props {
  exercise: StudentExercise
  result?: ExerciseResult
  onSubmit: (exerciseId: number, answer: string | number | Record<string, unknown>) => void
  disabled?: boolean
}

export default function ExerciseCard({ exercise, result, onSubmit, disabled }: Props) {
  if (exercise.type === 'MULTIPLE_CHOICE')
    return <MultipleChoiceExercise exercise={exercise} result={result} onSubmit={onSubmit as any} disabled={disabled} />
  if (exercise.type === 'FREE_TEXT')
    return <FreeTextExercise exercise={exercise} result={result} onSubmit={onSubmit as any} disabled={disabled} />
  if (exercise.type === 'INTERACTIVE')
    return <InteractiveExercise exercise={exercise} result={result} onSubmit={onSubmit as any} disabled={disabled} />
  return null
}
```

- [ ] **Step 2: Update `handleExerciseSubmit` in SessionShell.tsx to handle vizState**

`handleExerciseSubmit` is at line ~646. Replace it entirely:

```ts
async function handleExerciseSubmit(exerciseId: number, answer: string | number | Record<string, unknown>) {
  setStreaming(true)
  try {
    const body = typeof answer === 'object' && answer !== null && !Array.isArray(answer)
      ? { vizState: answer }
      : { answer }
    const res = await apiFetch(`${apiBase}/exercises/${exerciseId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Server error ${res.status}`)
    await consumeSse(res, handleSseEvent)
    if (activeExerciseRef.current === null && pendingRef.current.length === 0) {
      callAdvance()
    }
  } catch {
    toast.error('Something went wrong submitting your answer. Please refresh the page.')
  } finally {
    setStreaming(false)
  }
}
```

- [ ] **Step 3: Update TheoryBlock component (line ~69) to render visualization**

Add `import VisualizationFrame from '@/components/VisualizationFrame'` at the top of SessionShell.tsx with the other imports.

Replace the `TheoryBlock` function at line ~69:

```tsx
function TheoryBlock({ blocks, visualization }: { blocks: string[]; visualization?: string }) {
  return (
    <div
      className="rounded-xl border border-gray-300 bg-white px-5 py-4"
      style={{ boxShadow: '0 4px 0 0 #d1d5db' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Theory</p>
      {blocks.map((block, i) => (
        <div key={i} className="text-sm text-gray-700 leading-relaxed mb-2 md-content last:mb-0">
          <ReactMarkdown>{block}</ReactMarkdown>
        </div>
      ))}
      {visualization && (
        <div className="mt-4">
          <VisualizationFrame html={visualization} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Forward visualization in the SSE handler (line ~462) and renderMessage (line ~706)**

In `handleSseEvent`, update the `system:theory_block` case (line ~462) to pass `visualization` into the message payload:

```ts
case 'system:theory_block': {
  const theoryMsg: ChatMessage = {
    id: crypto.randomUUID(),
    sessionId: '',
    role: 'SYSTEM',
    type: 'THEORY_BLOCK',
    payload: {
      conceptId: event.payload.conceptId,
      blocks: event.payload.blocks,
      visualization: event.payload.visualization,   // ← add this
    },
    order: 0,
    createdAt: new Date().toISOString(),
  }
  pendingRef.current = [...pendingRef.current, theoryMsg]
  setPendingMessages(prev => [...prev, theoryMsg])
  break
}
```

In `renderMessage` (line ~706), update the THEORY_BLOCK case:

```tsx
case 'THEORY_BLOCK':
  return <TheoryBlock key={msg.id} blocks={msg.payload.blocks} visualization={msg.payload.visualization} />
```

- [ ] **Step 5: Typecheck**

```bash
cd apps/web && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/student/courses/[id]/module/[moduleId]/session/ExerciseCard.tsx \
        apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx
git commit -m "feat: wire up INTERACTIVE exercise dispatch and theory block visualization rendering"
```

---

### Task 8: Course generation — Pass 2 visualization

**Files:**
- Modify: `apps/api/src/services/courseGeneration.ts`

- [ ] **Step 1: Add visualization fields to Pass2Schema**

Find `Pass2Schema` at the top of `courseGeneration.ts` and update:

```ts
const Pass2Schema = z.object({
  concepts: z.array(z.object({
    name:              z.string(),
    theoryBlocks:      z.array(z.string()),
    shouldVisualize:   z.boolean(),
    visualizationHtml: z.string().optional(),
  })),
})
```

- [ ] **Step 2: Add VISUALIZATION_CONTRACT constant**

After the existing `MATH_SYNTAX_CONTRACT` import, add a new constant:

```ts
const VISUALIZATION_CONTRACT = `
VISUALIZATION CONTRACT — follow exactly when shouldVisualize is true:
- Output a complete, self-contained HTML document (<!DOCTYPE html>...)
- All CSS and JS must be inline — no external stylesheets
- CDN scripts: load only from https://cdnjs.cloudflare.com/
  Recommended: Plotly.js (interactive charts), Math.js (expression parsing), D3.js (custom viz)
- On every user interaction, emit current state:
    window.parent.postMessage({ type: 'viz-state', data: { key: value } }, '*')
- Emit state once on load with initial values
- Do NOT use: fetch(), XMLHttpRequest, localStorage, sessionStorage, cookies, external images
- Visual style: white background (#ffffff), dark text (#111827), accent color #6366f1
- Compact: fit within 320px height, no internal scrollbars, responsive width
`.trim()
```

- [ ] **Step 3: Update buildPass2Prompt to request visualization**

Append to the end of `buildPass2Prompt` return string (just before the closing backtick):

```ts
// Add inside the return template literal, after the existing MATH_SYNTAX_CONTRACT section:
For each concept, decide whether an interactive visualization would help students understand it intuitively.
Set shouldVisualize: true and provide visualizationHtml for concepts where interaction (sliders, graphs, toggles) meaningfully aids intuition — e.g. "slope of a line", "unit circle". Set shouldVisualize: false for purely definitional concepts.

${VISUALIZATION_CONTRACT}
```

- [ ] **Step 4: Update writeModuleConcepts to save visualization**

In `writeModuleConcepts`, after the `theoryBlock.createMany` call, add:

```ts
if (gen.shouldVisualize && gen.visualizationHtml) {
  await prisma.concept.update({
    where: { id: concept.id },
    data:  { visualization: gen.visualizationHtml },
  })
}
```

- [ ] **Step 5: Update math validation extractStrings in runPass2**

The `extractStrings` lambda only extracts theory block strings. Visualization HTML contains JS/HTML, not math — no need to include it. No change needed here.

- [ ] **Step 6: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/courseGeneration.ts
git commit -m "feat: generate exploratory visualization HTML in course generation Pass 2"
```

---

### Task 9: Course generation — Pass 3 INTERACTIVE exercises

**Files:**
- Modify: `apps/api/src/services/courseGeneration.ts`

- [ ] **Step 1: Update Pass3Schema to include interactive type**

Note: Flat schema is required — Anthropic structured output does not support oneOf/anyOf discriminated unions. All type-specific fields are optional; `type` drives which are populated.

```ts
const Pass3Schema = z.object({
  exercises: z.array(z.object({
    type:              z.enum(['multiple_choice', 'free_text', 'interactive']),
    conceptNames:      z.array(z.string()),
    question:          z.string(),
    // multiple_choice fields
    options:           z.array(z.string()).nullable(),
    correctIndex:      z.number().nullable(),
    explanation:       z.string().nullable(),
    // free_text fields
    sampleAnswer:      z.string().nullable(),
    rubric:            z.string().nullable(),
    // interactive fields
    visualizationHtml: z.string().nullable(),
    targetState:       z.record(z.unknown()).nullable(),
  })),
})
```

- [ ] **Step 2: Add interactive exercise instructions to buildPass3Prompt**

In `buildPass3Prompt`, extend the TASK section. Find the line `- Exercises must test understanding at the level appropriate for: ${course.targetAudience}` and add after it:

```ts
// Add to the template literal:
- You may also generate interactive exercises (type: "interactive") where the student manipulates a visualization to reach a target state. Use this for concepts where hands-on manipulation is more meaningful than text answers.
- interactive: provide visualizationHtml (self-contained HTML with all JS inline) and targetState (JSON object the student must reach, e.g. { slope: 2, intercept: -3 })

INTERACTIVE EXERCISE ADDITIONAL CONTRACT:
- visualizationHtml must emit state via: window.parent.postMessage({ type: 'viz-state', data: {...} }, '*')
- Include a visible target indicator in the visualization so the student knows what to aim for
- targetState keys must match exactly what the visualization emits in data: {}
- CDN scripts: load only from https://cdnjs.cloudflare.com/
- No fetch(), no localStorage, white background, max 320px height
```

- [ ] **Step 3: Update writeModuleExercises to handle interactive type**

In `writeModuleExercises`, find the `prisma.exercise.create` call. Update to handle the interactive type:

```ts
// Normalize MC fields
const options      = ex.type === 'multiple_choice' ? ex.options?.slice(0, 4) : null
const correctIndex = options ? Math.min(ex.correctIndex ?? 0, options.length - 1) : null

// Map to DB enum
const exerciseType =
  ex.type === 'multiple_choice' ? 'MULTIPLE_CHOICE' :
  ex.type === 'free_text'       ? 'FREE_TEXT'       :
                                  'INTERACTIVE'

const exercise = await prisma.exercise.create({
  data: {
    courseModuleId:    moduleId,
    type:              exerciseType,
    question:          ex.question,
    order:             exerciseOrder++,
    options,
    correctIndex,
    explanation:       ex.explanation,
    sampleAnswer:      ex.sampleAnswer,
    rubric:            ex.rubric,
    visualizationHtml: ex.visualizationHtml ?? null,
    targetState:       ex.targetState ?? undefined,
  },
})
```

Also update `extractStrings` in `runPass3` to skip viz HTML (it's not math text):

```ts
extractStrings: (output) => output.exercises.flatMap(ex => [
  ex.question,
  ...(ex.options ?? []),
  ex.explanation  ?? '',
  ex.sampleAnswer ?? '',
  ex.rubric       ?? '',
  // visualizationHtml intentionally excluded — not math text
]),
```

- [ ] **Step 4: Typecheck**

```bash
cd apps/api && pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run all tests**

```bash
cd apps/api && pnpm test
```

Expected: all tests pass (including vizGrading tests from Task 4).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/courseGeneration.ts
git commit -m "feat: generate INTERACTIVE exercises in course generation Pass 3"
```

---

## Verification

After all tasks are complete:

1. **Trigger course generation** on a math course. Check the DB: some `Concept` rows should have non-null `visualization`; some `Exercise` rows should have `type=INTERACTIVE` with `visualizationHtml` and `targetState`.

2. **Open a student session** for that module. Theory blocks with visualizations should render the iframe below the theory text. The iframe should be interactive (sliders/buttons work).

3. **Submit an INTERACTIVE exercise** with the correct viz state by matching what the visualization shows. Confirm `correct: true` returned and score advances.

4. **Submit with wrong state**. Confirm `correct: false` and score decreases.

5. **Security check**: Open browser DevTools → Network tab while inside the iframe. Confirm no external requests. Open Console and run `window.parent.document` — should throw or return null (cross-origin block from sandbox).
