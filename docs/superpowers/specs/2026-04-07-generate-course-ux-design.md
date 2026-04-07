# Generate Course UX — Design Spec

**Date:** 2026-04-07
**Status:** Approved

## Problem

When a teacher clicks "Generate course" on the wizard's Review step, there are a couple of seconds of silence before the redirect to the courses page. No loading feedback is shown, so the action appears to have done nothing. The delay comes from the `POST /api/courses` round-trip, which runs a Prisma transaction with ~22 sequential INSERT statements.

## Scope

This spec covers two changes:

1. Frontend loading state on the wizard's Generate button
2. Backend batch-insert optimisation to reduce the `POST /api/courses` response time

Generation time (the async LLM pipeline running after the 201 response) is out of scope.

---

## 1. Frontend — Button Loading State

**File:** `apps/web/src/components/wizard/StepReview.tsx`

### Behaviour

| State | Generate button | Back button |
|-------|----------------|-------------|
| Idle | Enabled, default style | Enabled |
| Submitting (`isSubmitting = true`) | Disabled, pulsing border animation | Disabled, muted style |
| Failed (handler returned, `isSubmitting = false`) | Re-enabled automatically | Re-enabled |

- `isSubmitting` comes from `form.formState` (React Hook Form). It is `true` from the moment `handleSubmit` fires until `onSubmit` returns — no extra state needed.
- On failure, `CourseWizard.onSubmit` calls `toast.error(...)` from `'sonner'` instead of the current `alert()`, then returns. `isSubmitting` drops back to `false` automatically, re-enabling the button.
- On success, the redirect fires immediately as today.

### Animation

The Generate button's disabled+loading state uses a CSS `box-shadow` keyframe animation cycling between a muted and a more prominent blue glow (~1.4 s period). The button background shifts to a light blue tint and text to blue so the border pulse reads as intentional, not broken.

```css
@keyframes border-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
  50%       { box-shadow: 0 0 0 6px rgba(59,130,246,0.12); }
}
```

Applied as a Tailwind `animate-[border-pulse_1.4s_ease-in-out_infinite]` or an inline style depending on what's already used elsewhere in the wizard.

---

## 2. Backend — Batch Inserts in POST /api/courses

**File:** `apps/api/src/routes/courses.ts`

### Current behaviour

The `POST /api/courses` handler wraps a single `prisma.$transaction` that uses Prisma's nested `create` syntax. For a course with N modules, each with O objectives and U outcomes, this generates:

```
1 INSERT (course)
+ N INSERTs (modules)
+ N × O INSERTs (objectives)
+ N × U INSERTs (outcomes)
```

For a typical 3-module course with 3 objectives and 3 outcomes per module: **22 sequential round-trips** through the Supabase connection pooler.

### New behaviour

Restructure the transaction into four phases:

1. `course.create` — create the course row, capture `courseId`
2. `courseModule.createMany` — bulk-insert all modules
3. `courseModule.findMany` — fetch back the created module rows to get their DB IDs (needed to associate objectives/outcomes)
4. `objective.createMany` + `outcome.createMany` — bulk-insert all objectives and all outcomes in two calls, using the IDs from step 3

Total: **4–5 round-trips** regardless of course size.

The response shape (`{ courseId: number }`) is unchanged. The transaction boundary is unchanged.

### ID mapping (step 3 detail)

After `createMany` for modules, the rows are identified by `(courseId, order)` — `order` is the wizard's module index, already written in step 2. A `findMany` on `{ courseId, order: { in: [...] } }` returns the DB IDs needed to set `courseModuleId` on each objective/outcome row.

---

## Out of Scope

- Pass 2/Pass 3 pipeline optimisation (reduces generation time, not redirect time)
- Toast placement / design system changes beyond wiring up the existing Sonner instance
