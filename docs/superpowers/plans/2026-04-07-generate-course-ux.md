# Generate Course UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the silent wait between clicking "Generate course" and being redirected, by adding a pulsing button loading state and reducing the POST /api/courses response time with batch DB inserts.

**Architecture:** The frontend uses React Hook Form's built-in `isSubmitting` flag (no new state) to drive a CSS-animated loading button. The backend restructures one `prisma.$transaction` from ~22 sequential INSERTs to 4–5 bulk operations using `createMany`, with a pure helper function that maps wizard module data to flat DB rows.

**Tech Stack:** Next.js, React Hook Form, Tailwind CSS, Sonner (toast), Prisma, Vitest

---

## File Map

| File | Change |
|------|--------|
| `apps/web/src/app/globals.css` | Add `@keyframes border-pulse` |
| `apps/web/src/components/wizard/StepReview.tsx` | Read `isSubmitting`, apply loading styles |
| `apps/web/src/components/wizard/CourseWizard.tsx` | Replace `alert()` with `toast.error()` |
| `apps/api/src/routes/courses.ts` | Extract helpers; replace nested creates with `createMany` |
| `apps/api/src/routes/courses.test.ts` | Unit tests for `buildObjectivesData` / `buildOutcomesData` |

---

## Task 1: Add border-pulse keyframe

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add the keyframe**

  Append to the bottom of `apps/web/src/app/globals.css`:

  ```css
  @keyframes border-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(13, 148, 136, 0.45); }
    50%       { box-shadow: 0 0 0 7px rgba(13, 148, 136, 0.1); }
  }
  ```

  The colour is teal-600 (`#0d9488`) — the app's `--primary` token — so the pulse matches the design system.

- [ ] **Step 2: Commit**

  ```bash
  git add apps/web/src/app/globals.css
  git commit -m "feat: add border-pulse keyframe for generate button loading state"
  ```

---

## Task 2: Update StepReview with loading state

**Files:**
- Modify: `apps/web/src/components/wizard/StepReview.tsx`

- [ ] **Step 1: Replace the file contents**

  Full replacement of `apps/web/src/components/wizard/StepReview.tsx`:

  ```tsx
  'use client'

  import { UseFormReturn } from 'react-hook-form'
  import type { CourseWizardInput } from '@metis/types'
  import { Button } from '@/components/ui/button'

  type Props = {
    form: UseFormReturn<CourseWizardInput>
    onBack: () => void
    onSubmit: () => void
  }

  export default function StepReview({ form, onBack, onSubmit }: Props) {
    const { getValues, formState: { isSubmitting } } = form
    const data = getValues()

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Review & generate</h2>
          <p className="text-sm text-gray-500 mt-1">
            Check everything looks right before the AI builds your course.
          </p>
        </div>

        {/* Basics summary */}
        <section className="space-y-1">
          <h3 className="text-sm font-semibold text-gray-700">Basics</h3>
          <div className="text-sm text-gray-600 space-y-0.5">
            <p><span className="text-gray-400">Name</span> {data.name}</p>
            <p><span className="text-gray-400">Subject</span> {data.subject}</p>
            <p><span className="text-gray-400">Language</span> {data.language}</p>
            <p><span className="text-gray-400">Audience</span> {data.targetAudience}</p>
          </div>
        </section>

        {/* Structure summary */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Structure</h3>
          {data.modules.map((m, i) => (
            <div key={m.id} className="text-sm text-gray-600">
              <p className="font-medium">{i + 1}. {m.name}</p>
              <p className="text-gray-400 text-xs ml-3">
                {m.objectives.length} objective{m.objectives.length !== 1 ? 's' : ''} ·{' '}
                {m.outcomes.length} outcome{m.outcomes.length !== 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </section>

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
            Back
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting}
            className={isSubmitting
              ? 'disabled:opacity-100 bg-primary/10 text-primary border border-primary/30 hover:bg-primary/10'
              : ''
            }
            style={isSubmitting ? { animation: 'border-pulse 1.4s ease-in-out infinite' } : undefined}
          >
            Generate course
          </Button>
        </div>
      </div>
    )
  }
  ```

  Key changes from the original:
  - `formState: { isSubmitting }` destructured from `form`
  - Back button: `disabled={isSubmitting}` (shadcn's default `disabled:opacity-50` is enough here)
  - Generate button: `disabled:opacity-100` overrides shadcn's opacity reduction; teal tint + animated border when submitting

- [ ] **Step 2: Verify in browser**

  Start the dev server (`pnpm dev` from repo root). Open the wizard, fill out the form, reach Step 4. Click "Generate course". Confirm:
  - Generate button turns teal-tinted with a pulsing glow
  - Back button greys out and is unclickable
  - Redirect fires after the API responds

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/components/wizard/StepReview.tsx
  git commit -m "feat: add pulsing loading state to generate course button"
  ```

---

## Task 3: Replace alert with toast on failure

**Files:**
- Modify: `apps/web/src/components/wizard/CourseWizard.tsx`

- [ ] **Step 1: Add the toast import and replace alert**

  At the top of `apps/web/src/components/wizard/CourseWizard.tsx`, add:
  ```ts
  import { toast } from 'sonner'
  ```

  Then replace the error branch in `onSubmit` (currently lines 68–71):
  ```ts
  // Before
  if (!res.ok) {
    console.error('Failed to create course', await res.text())
    alert('Failed to create course. Please try again later.')
    return
  }

  // After
  if (!res.ok) {
    console.error('Failed to create course', await res.text())
    toast.error('Failed to create course. Please try again.')
    return
  }
  ```

- [ ] **Step 2: Verify in browser**

  To test the failure path without breaking the backend: temporarily change the `apiFetch` URL to a bad endpoint (e.g., append `/bad`), submit the form, confirm a toast appears and the Generate button re-enables. Revert the URL change.

- [ ] **Step 3: Commit**

  ```bash
  git add apps/web/src/components/wizard/CourseWizard.tsx
  git commit -m "feat: replace alert with toast on course creation failure"
  ```

---

## Task 4: Write failing tests for batch-insert helpers

**Files:**
- Create: `apps/api/src/routes/courses.test.ts`

The transaction refactor (Task 5) extracts two pure functions that map wizard module data + DB module IDs to flat arrays ready for `createMany`. Write the tests first.

- [ ] **Step 1: Create the test file**

  Create `apps/api/src/routes/courses.test.ts`:

  ```ts
  import { describe, it, expect } from 'vitest'
  import { buildObjectivesData, buildOutcomesData } from './courses'

  const wizardModules = [
    {
      objectives: [{ text: 'Understand vectors' }, { text: 'Add vectors' }],
      outcomes:   [{ text: 'Solve vector problems' }],
    },
    {
      objectives: [{ text: 'Multiply matrices' }],
      outcomes:   [{ text: 'Apply matrix ops' }, { text: 'Invert a matrix' }],
    },
  ]

  const dbModules = [
    { id: 101, order: 0 },
    { id: 102, order: 1 },
  ]

  describe('buildObjectivesData()', () => {
    it('flattens objectives from all modules with correct courseModuleId', () => {
      const result = buildObjectivesData(wizardModules, dbModules)
      expect(result).toEqual([
        { text: 'Understand vectors', courseModuleId: 101 },
        { text: 'Add vectors',        courseModuleId: 101 },
        { text: 'Multiply matrices',  courseModuleId: 102 },
      ])
    })

    it('returns an empty array when modules list is empty', () => {
      expect(buildObjectivesData([], [])).toEqual([])
    })

    it('skips a module if its order has no matching DB row', () => {
      const partial = [{ id: 101, order: 0 }] // order 1 is missing
      const result = buildObjectivesData(wizardModules, partial)
      expect(result).toEqual([
        { text: 'Understand vectors', courseModuleId: 101 },
        { text: 'Add vectors',        courseModuleId: 101 },
      ])
    })
  })

  describe('buildOutcomesData()', () => {
    it('flattens outcomes from all modules with correct courseModuleId', () => {
      const result = buildOutcomesData(wizardModules, dbModules)
      expect(result).toEqual([
        { text: 'Solve vector problems', courseModuleId: 101 },
        { text: 'Apply matrix ops',      courseModuleId: 102 },
        { text: 'Invert a matrix',       courseModuleId: 102 },
      ])
    })

    it('returns an empty array when modules list is empty', () => {
      expect(buildOutcomesData([], [])).toEqual([])
    })
  })
  ```

- [ ] **Step 2: Run tests — confirm they fail**

  ```bash
  cd apps/api && pnpm test --reporter=verbose courses.test
  ```

  Expected: **FAIL** — `buildObjectivesData` and `buildOutcomesData` are not exported yet.

---

## Task 5: Implement helpers and batch-insert transaction

**Files:**
- Modify: `apps/api/src/routes/courses.ts`

- [ ] **Step 1: Export the two helper functions**

  Add these two functions just above the `router.post('/', ...)` declaration in `apps/api/src/routes/courses.ts`:

  ```ts
  export function buildObjectivesData(
    modules: Array<{ objectives: Array<{ text: string }> }>,
    dbModules: Array<{ id: number; order: number }>,
  ): Array<{ text: string; courseModuleId: number }> {
    const idByOrder = new Map(dbModules.map(m => [m.order, m.id]))
    return modules.flatMap((m, order) => {
      const moduleId = idByOrder.get(order)
      if (moduleId === undefined) return []
      return m.objectives.map(o => ({ text: o.text, courseModuleId: moduleId }))
    })
  }

  export function buildOutcomesData(
    modules: Array<{ outcomes: Array<{ text: string }> }>,
    dbModules: Array<{ id: number; order: number }>,
  ): Array<{ text: string; courseModuleId: number }> {
    const idByOrder = new Map(dbModules.map(m => [m.order, m.id]))
    return modules.flatMap((m, order) => {
      const moduleId = idByOrder.get(order)
      if (moduleId === undefined) return []
      return m.outcomes.map(o => ({ text: o.text, courseModuleId: moduleId }))
    })
  }
  ```

- [ ] **Step 2: Run tests — confirm they pass**

  ```bash
  cd apps/api && pnpm test --reporter=verbose courses.test
  ```

  Expected: all 5 tests **PASS**.

- [ ] **Step 3: Replace the transaction body**

  In `router.post('/', requireAuth, ...)`, replace the `prisma.$transaction(async (tx) => { ... })` block (currently lines 17–38) with:

  ```ts
  const courseId: number = await prisma.$transaction(async (tx) => {
    // Phase 1 — course row
    const course = await tx.course.create({
      data: {
        teacherId:      req.user!.id,
        status:         'GENERATING',
        name:           body.name,
        subject:        body.subject,
        language:       body.language,
        targetAudience: body.targetAudience,
      },
    })

    // Phase 2 — all modules in one INSERT
    await tx.courseModule.createMany({
      data: body.modules.map((m, index) => ({
        courseId: course.id,
        name:     m.name,
        order:    index,
      })),
    })

    // Phase 3 — fetch back DB IDs (identified by courseId + order)
    const dbModules = await tx.courseModule.findMany({
      where:  { courseId: course.id },
      select: { id: true, order: true },
    })

    // Phase 4 — objectives and outcomes in two bulk INSERTs
    await tx.learningObjective.createMany({
      data: buildObjectivesData(body.modules, dbModules),
    })

    await tx.learningOutcome.createMany({
      data: buildOutcomesData(body.modules, dbModules),
    })

    return course.id
  })
  ```

- [ ] **Step 4: Run the full test suite to catch regressions**

  ```bash
  cd apps/api && pnpm test --reporter=verbose
  ```

  Expected: all tests pass (the new `courses.test` tests plus all pre-existing tests).

- [ ] **Step 5: Typecheck**

  ```bash
  cd apps/api && pnpm typecheck
  ```

  Expected: no errors.

- [ ] **Step 6: Manual smoke test**

  Start the API (`pnpm dev` from repo root). Open the wizard, complete all steps, click "Generate course". Confirm:
  - Button pulses while the request is in-flight
  - Redirect to `/teacher/courses` fires promptly (noticeably faster than before)
  - New course appears in the list with status "generating"

- [ ] **Step 7: Commit**

  ```bash
  git add apps/api/src/routes/courses.ts apps/api/src/routes/courses.test.ts
  git commit -m "perf: batch-insert objectives and outcomes in POST /api/courses transaction"
  ```
