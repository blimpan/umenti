# Teacher Analytics Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the teacher analytics dashboard with class concept diagnostics, per-student concept drilldown, exercise-level answer analysis, on-demand LLM-generated pattern summaries, and at-risk student flagging.

**Architecture:** Add `answer String?` to `ExerciseAttempt` to capture raw student answers at submission time. Add an `ExerciseAnalysis` model to cache per-exercise LLM analysis, triggered on-demand by the teacher. Extend the existing analytics API endpoint and add three new sub-endpoints in `courses.ts`. On the frontend, decompose `AnalyticsTab.tsx` into three focused section components.

**Tech Stack:** Vitest, Prisma, Vercel AI SDK (`generateText` + `Output.object`), Zod, Recharts (already installed), Next.js App Router.

---

## File Map

**Modified:**
- `packages/types/src/index.ts` — new and updated analytics types
- `apps/api/prisma/schema.prisma` — `answer` on `ExerciseAttempt`; new `ExerciseAnalysis` model
- `apps/api/src/routes/session.ts` — capture `answerText` at submission and include in `createMany`
- `apps/api/src/routes/courses.ts` — extend analytics endpoint; add 3 new sub-routes
- `apps/api/src/lib/analytics.ts` — add `computeAtRisk` pure helper
- `apps/api/src/lib/analytics.test.ts` — tests for `computeAtRisk`
- `apps/web/src/app/teacher/courses/[id]/AnalyticsTab.tsx` — compose new sections

**Created:**
- `apps/api/src/lib/exerciseAnalysis.ts` — LLM analysis generation + upsert to `ExerciseAnalysis`
- `apps/api/src/lib/exerciseAnalysis.test.ts` — unit tests with mocked LLM + Prisma
- `apps/web/src/app/teacher/courses/[id]/analytics/ConceptBreakdownSection.tsx`
- `apps/web/src/app/teacher/courses/[id]/analytics/StudentTable.tsx`
- `apps/web/src/app/teacher/courses/[id]/analytics/ExerciseAnalysisSection.tsx`

---

## Task 1: Schema — add `answer` to `ExerciseAttempt`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add `answer` field to the `ExerciseAttempt` model**

In `apps/api/prisma/schema.prisma`, change the `ExerciseAttempt` model to:

```prisma
model ExerciseAttempt {
  id          Int          @id @default(autoincrement())
  userId      String
  exerciseId  Int
  sessionId   String
  conceptId   Int
  moduleId    Int
  courseId    Int
  phase       AttemptPhase
  isCorrect   Boolean
  scoreChange Float
  answer      String?
  createdAt   DateTime     @default(now())

  @@index([userId, courseId])
  @@index([courseId, conceptId])
  @@index([courseId, createdAt])
}
```

- [ ] **Step 2: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name add_answer_to_exercise_attempt
```

Expected: migration file created in `prisma/migrations/`, Prisma client regenerated.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add answer field to ExerciseAttempt"
```

---

## Task 3: Schema — add `ExerciseAnalysis` model

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add `ExerciseAnalysis` model and back-references**

In `apps/api/prisma/schema.prisma`, add the new model at the end of the file:

```prisma
model ExerciseAnalysis {
  id                       Int      @id @default(autoincrement())
  exerciseId               Int      @unique
  courseId                 Int
  summary                  String
  commonMisconceptions     Json     // string[]
  attemptCountAtGeneration Int
  generatedAt              DateTime @default(now())

  exercise Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)
  course   Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@index([courseId])
}
```

Add the back-reference to `Exercise` (inside the `Exercise` model, after `source ExerciseSource`):

```prisma
  analysis     ExerciseAnalysis?
```

Add the back-reference to `Course` (inside the `Course` model, after `enrollments Enrollment[]`):

```prisma
  exerciseAnalyses ExerciseAnalysis[]
```

- [ ] **Step 2: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name add_exercise_analysis
```

Expected: migration file created, Prisma client regenerated.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add ExerciseAnalysis model"
```

---

## Task 4: Add new types to the shared types package

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Update `CourseAnalyticsStudent` and `GetCourseAnalyticsResponse`**

Find and replace the existing `CourseAnalyticsStudent` and `GetCourseAnalyticsResponse` types in `packages/types/src/index.ts`:

```typescript
export type ConceptBreakdownItem = {
  conceptId: number
  conceptName: string
  totalAttempts: number
  incorrectRate: number   // 0–1; fraction of attempts that were incorrect
}

export type CourseAnalyticsStudent = {
  userId: string
  email: string
  progress: number | null   // 0–100; null if student never opened a module
  lastActiveAt: string | null
  atRisk: boolean           // true when progress < 50 and inactive for > 7 days
}

export type AttemptsOverTimePoint = {
  date: string
  correct: number
  incorrect: number
  total: number
}

export type GetCourseAnalyticsResponse = {
  students: CourseAnalyticsStudent[]
  attemptsOverTime: AttemptsOverTimePoint[]
  granularity: 'hour' | 'day' | 'week'
  conceptBreakdown: ConceptBreakdownItem[]
}
```

- [ ] **Step 2: Add per-student concept drilldown types**

Append after the types above:

```typescript
export type StudentConceptDetail = {
  conceptId: number
  conceptName: string
  effectiveScore: number | null   // null if student has no progress row for this concept
  totalAttempts: number
  correctRate: number | null      // null if totalAttempts === 0
}

export type GetStudentConceptsResponse = {
  concepts: StudentConceptDetail[]
}
```

- [ ] **Step 3: Add exercise analytics types**

Append after the types above:

```typescript
export type ExerciseAnalysisSummary = {
  exerciseId: number
  moduleId: number
  moduleName: string
  question: string
  totalAttempts: number
  correctRate: number | null      // null if no attempts
  analysisStatus: 'none' | 'ready' | 'stale'   // stale = new attempts since last analysis
  generatedAt: string | null
  summary: string | null
  commonMisconceptions: string[] | null
}

export type GetExerciseAnalyticsResponse = {
  exercises: ExerciseAnalysisSummary[]
}

export type TriggerAnalysisResponse = {
  exerciseId: number
  summary: string
  commonMisconceptions: string[]
  generatedAt: string
}
```

- [ ] **Step 4: Build the types package to verify no type errors**

```bash
pnpm --filter @metis/types build
```

Expected: exits 0 with no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat: add analytics types for concept breakdown, student drilldown, exercise analysis"
```

---

## Task 5: Capture `answer` at exercise submission

**Files:**
- Modify: `apps/api/src/routes/session.ts` (around line 560)

- [ ] **Step 1: Add `answerText` computation before the `createMany` call**

In `apps/api/src/routes/session.ts`, find the block that starts with:

```typescript
    // ── Record attempt rows (one per concept) ─────────────────────────────────
    const moduleId2  = exercise.courseModuleId
    const courseId2  = exercise.courseModule.courseId
    prisma.exerciseAttempt.createMany({
      data: conceptIds.map(conceptId => ({
        userId:     req.user!.id,
        exerciseId,
        sessionId:  session.id,
        conceptId,
        moduleId:   moduleId2,
        courseId:   courseId2,
        phase:      isPhase1 ? 'PRIOR_KNOWLEDGE' : 'MAIN',
        isCorrect:  correct,
        scoreChange: isPhase1 ? 0 : scoreChange,
      })),
    }).catch(err => logger.error({ err }, '[ExerciseAttempt insert]'))
```

Replace it with:

```typescript
    // ── Record attempt rows (one per concept) ─────────────────────────────────
    const moduleId2  = exercise.courseModuleId
    const courseId2  = exercise.courseModule.courseId

    // Normalise the raw answer to a human-readable string for LLM analysis.
    // MULTIPLE_CHOICE: resolve option text so the LLM sees words, not indices.
    // INTERACTIVE: serialise vizState so the submission is inspectable.
    // FREE_TEXT / MATH: use the raw string.
    const options = exercise.options as string[] | null
    const answerText: string =
      exercise.type === 'MULTIPLE_CHOICE'
        ? String(
            options?.[typeof answer === 'number' ? answer : parseInt(String(answer))] ?? answer
          )
        : exercise.type === 'INTERACTIVE'
        ? JSON.stringify((req.body as { vizState?: unknown }).vizState ?? {})
        : String(answer)

    prisma.exerciseAttempt.createMany({
      data: conceptIds.map(conceptId => ({
        userId:     req.user!.id,
        exerciseId,
        sessionId:  session.id,
        conceptId,
        moduleId:   moduleId2,
        courseId:   courseId2,
        phase:      isPhase1 ? 'PRIOR_KNOWLEDGE' : 'MAIN',
        isCorrect:  correct,
        scoreChange: isPhase1 ? 0 : scoreChange,
        answer:     answerText,
      })),
    }).catch(err => logger.error({ err }, '[ExerciseAttempt insert]'))
```

- [ ] **Step 2: Verify the API compiles**

```bash
pnpm --filter @metis/api typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/session.ts
git commit -m "feat: capture student answer text in ExerciseAttempt"
```

---

## Task 6: Add `computeAtRisk` helper to analytics.ts

**Files:**
- Modify: `apps/api/src/lib/analytics.ts`
- Modify: `apps/api/src/lib/analytics.test.ts`

- [ ] **Step 1: Write the failing tests for `computeAtRisk`**

Append to `apps/api/src/lib/analytics.test.ts`:

```typescript
import { computeAtRisk } from './analytics'

describe('computeAtRisk', () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 - 1).toISOString()
  const yesterday    = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  it('returns false when progress is null (student never started)', () => {
    expect(computeAtRisk(null, null)).toBe(false)
  })

  it('returns false when progress is 50 or above', () => {
    expect(computeAtRisk(50, sevenDaysAgo)).toBe(false)
    expect(computeAtRisk(75, sevenDaysAgo)).toBe(false)
  })

  it('returns false when progress < 50 but student was active within 7 days', () => {
    expect(computeAtRisk(30, yesterday)).toBe(false)
  })

  it('returns true when progress < 50 and inactive for more than 7 days', () => {
    expect(computeAtRisk(49, sevenDaysAgo)).toBe(true)
    expect(computeAtRisk(0, sevenDaysAgo)).toBe(true)
  })

  it('returns true when progress < 50 and lastActiveAt is null', () => {
    // Enrolled and has concept progress but no session — edge case
    expect(computeAtRisk(20, null)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd apps/api && pnpm test -- --reporter=verbose analytics.test
```

Expected: `computeAtRisk` tests fail with "not a function".

- [ ] **Step 3: Implement `computeAtRisk` in analytics.ts**

Append to `apps/api/src/lib/analytics.ts`:

```typescript
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Returns true when a student is at risk of falling behind.
 * Criteria: progress is defined but below 50, AND the student has not been
 * active in the last 7 days (or has never been active despite having progress).
 */
export function computeAtRisk(
  progress: number | null,
  lastActiveAt: string | null
): boolean {
  if (progress === null || progress >= 50) return false
  if (!lastActiveAt) return true
  return Date.now() - new Date(lastActiveAt).getTime() > SEVEN_DAYS_MS
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd apps/api && pnpm test -- --reporter=verbose analytics.test
```

Expected: all `computeAtRisk` tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/analytics.ts apps/api/src/lib/analytics.test.ts
git commit -m "feat: add computeAtRisk helper with tests"
```

---

## Task 7: Extend `GET /api/courses/:id/analytics` with concept breakdown + `atRisk`

**Files:**
- Modify: `apps/api/src/routes/courses.ts`

- [ ] **Step 1: Add `computeAtRisk` import at the top of courses.ts**

Find:

```typescript
import { computeProgress, latestSession, pickGranularity } from '../lib/analytics'
```

Replace with:

```typescript
import { computeProgress, latestSession, pickGranularity, computeAtRisk } from '../lib/analytics'
```

- [ ] **Step 2: Extend Round 1 and Round 2 to fetch concept names and breakdown data**

Find the Round 2 parallel query block in the analytics handler (the block containing `progressRows, sessionRows, attemptRows`):

```typescript
    const [progressRows, sessionRows, attemptRows] = await Promise.all([
```

Replace the entire Round 2 block with:

```typescript
    const [progressRows, sessionRows, attemptRows, conceptBreakdownRows, conceptNames] = await Promise.all([
      prisma.studentConceptProgress.findMany({
        where: {
          userId: { in: userIds },
          concept: { courseId },
        },
        select: { userId: true, score: true, lastActivityAt: true },
      }),
      prisma.moduleSession.findMany({
        where: {
          userId: { in: userIds },
          module: { courseId },
        },
        select: { userId: true, updatedAt: true },
      }),
      prisma.$queryRaw<{ date: Date; correct: bigint; incorrect: bigint; total: bigint }[]>`
        SELECT
          DATE_TRUNC(${granularity}, "createdAt") AS date,
          COUNT(*) FILTER (WHERE "isCorrect" = true)  AS correct,
          COUNT(*) FILTER (WHERE "isCorrect" = false) AS incorrect,
          COUNT(*)                                     AS total
        FROM "ExerciseAttempt"
        WHERE "courseId" = ${courseId}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      // Concept-level breakdown: total and incorrect attempt counts per concept
      prisma.$queryRaw<{ conceptId: number; total: bigint; incorrect: bigint }[]>`
        SELECT
          "conceptId",
          COUNT(*)                                     AS total,
          COUNT(*) FILTER (WHERE "isCorrect" = false) AS incorrect
        FROM "ExerciseAttempt"
        WHERE "courseId" = ${courseId}
        GROUP BY "conceptId"
      `,
      prisma.concept.findMany({
        where:  { courseId },
        select: { id: true, name: true },
      }),
    ])
```

- [ ] **Step 3: Build the concept breakdown and add `atRisk` + `userId` to each student**

Find the block that builds the `students` array (ending just before `const result:`):

```typescript
    const students = validEnrollments
      .map(e => ({
        email: e.student.user.email,
        progress: computeProgress(progressByUser.get(e.userId) ?? []),
        lastActiveAt: latestSession(sessionsByUser.get(e.userId) ?? []),
      }))
```

Replace it with:

```typescript
    const conceptNameMap = new Map(conceptNames.map(c => [c.id, c.name]))

    const conceptBreakdown = conceptBreakdownRows
      .filter(r => Number(r.total) > 0)
      .map(r => ({
        conceptId:    r.conceptId,
        conceptName:  conceptNameMap.get(r.conceptId) ?? `Concept ${r.conceptId}`,
        totalAttempts: Number(r.total),
        incorrectRate: Number(r.incorrect) / Number(r.total),
      }))
      .sort((a, b) => b.incorrectRate - a.incorrectRate)

    const students = validEnrollments
      .map(e => {
        const progress     = computeProgress(progressByUser.get(e.userId) ?? [])
        const lastActiveAt = latestSession(sessionsByUser.get(e.userId) ?? [])
        return {
          userId:      e.userId,
          email:       e.student.user.email,
          progress,
          lastActiveAt,
          atRisk:      computeAtRisk(progress, lastActiveAt),
        }
      })
```

- [ ] **Step 4: Add `conceptBreakdown` to the response**

Find:

```typescript
    const result: GetCourseAnalyticsResponse = {
      students,
      granularity,
      attemptsOverTime: attemptRows.map(r => ({
```

Replace with:

```typescript
    const result: GetCourseAnalyticsResponse = {
      students,
      granularity,
      conceptBreakdown,
      attemptsOverTime: attemptRows.map(r => ({
```

- [ ] **Step 5: Update the `GetCourseAnalyticsResponse` import if needed**

Ensure `GetCourseAnalyticsResponse` is imported from `@metis/types` at the top of the file. It should already be there — verify and leave unchanged if so.

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @metis/api typecheck
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/courses.ts
git commit -m "feat: add concept breakdown and atRisk to analytics endpoint"
```

---

## Task 8: Add `GET /api/courses/:id/analytics/students/:userId/concepts` endpoint

**Files:**
- Modify: `apps/api/src/routes/courses.ts`

Add the following route directly after the closing `})` of the existing analytics handler:

- [ ] **Step 1: Add the route**

Find the line `router.delete('/:id', requireAuth, async (req, res) => {` and insert the following block immediately before it:

```typescript
// GET /api/courses/:id/analytics/students/:userId/concepts
// Returns per-concept mastery detail for one student — used for drilldown rows.
router.get('/:id/analytics/students/:userId/concepts', requireAuth, async (req, res) => {
  const courseId = parseInt(req.params.id as string)
  const targetUserId = req.params.userId as string
  if (isNaN(courseId)) { res.status(400).json({ error: 'Invalid course ID' }); return }

  try {
    const course = await prisma.course.findFirst({
      where: { id: courseId, teacherId: req.user!.id },
      select: { id: true },
    })
    if (!course) { res.status(404).json({ error: 'Course not found' }); return }

    const [concepts, progressRows, attemptRows] = await Promise.all([
      prisma.concept.findMany({
        where:  { courseId },
        select: { id: true, name: true },
        orderBy: { id: 'asc' },
      }),
      prisma.studentConceptProgress.findMany({
        where: { userId: targetUserId, concept: { courseId } },
        select: { conceptId: true, score: true, lastActivityAt: true },
      }),
      prisma.$queryRaw<{ conceptId: number; total: bigint; correct: bigint }[]>`
        SELECT "conceptId",
               COUNT(*)                                    AS total,
               COUNT(*) FILTER (WHERE "isCorrect" = true) AS correct
        FROM "ExerciseAttempt"
        WHERE "courseId" = ${courseId}
          AND "userId"   = ${targetUserId}
        GROUP BY "conceptId"
      `,
    ])

    const progressMap = new Map(progressRows.map(r => [r.conceptId, r]))
    const attemptMap  = new Map(attemptRows.map(r => [r.conceptId, r]))

    const result: import('@metis/types').GetStudentConceptsResponse = {
      concepts: concepts.map(c => {
        const prog   = progressMap.get(c.id)
        const att    = attemptMap.get(c.id)
        const total  = att ? Number(att.total) : 0
        const correct = att ? Number(att.correct) : 0
        return {
          conceptId:    c.id,
          conceptName:  c.name,
          effectiveScore: prog
            ? Math.min(100, Math.max(0, (await import('../lib/decay').then(m => m.applyDecay))(prog.score, prog.lastActivityAt)))
            : null,
          totalAttempts: total,
          correctRate:   total > 0 ? correct / total : null,
        }
      }),
    }

    res.json(result)
  } catch (err) {
    logger.error({ err }, '[GET /api/courses/:id/analytics/students/:userId/concepts]')
    res.status(500).json({ error: 'Failed to fetch student concept detail' })
  }
})
```

Wait — `applyDecay` should be imported at the top of the file, not dynamically. Replace the inline dynamic import with a proper static import. Find the imports at the top of courses.ts and add:

```typescript
import { applyDecay } from '../lib/decay'
```

Then replace the `effectiveScore` line in the route above with:

```typescript
          effectiveScore: prog
            ? Math.min(100, Math.max(0, applyDecay(prog.score, prog.lastActivityAt)))
            : null,
```

And remove the `await import(...)` version.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @metis/api typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/courses.ts
git commit -m "feat: add student concept drilldown endpoint"
```

---

## Task 9: Add `GET /api/courses/:id/analytics/exercises` endpoint

**Files:**
- Modify: `apps/api/src/routes/courses.ts`

- [ ] **Step 1: Add the route**

Insert directly after the student drilldown route added in Task 8:

```typescript
// GET /api/courses/:id/analytics/exercises
// Returns per-exercise attempt stats and cached LLM analysis status.
router.get('/:id/analytics/exercises', requireAuth, async (req, res) => {
  const courseId = parseInt(req.params.id as string)
  if (isNaN(courseId)) { res.status(400).json({ error: 'Invalid course ID' }); return }

  try {
    const course = await prisma.course.findFirst({
      where: { id: courseId, teacherId: req.user!.id },
      select: { id: true },
    })
    if (!course) { res.status(404).json({ error: 'Course not found' }); return }

    const [exercises, attemptRows, analyses] = await Promise.all([
      prisma.exercise.findMany({
        where:   { courseModule: { courseId } },
        select: {
          id: true,
          question: true,
          courseModuleId: true,
          courseModule: { select: { name: true } },
        },
        orderBy: [{ courseModuleId: 'asc' }, { order: 'asc' }],
      }),
      prisma.$queryRaw<{ exerciseId: number; total: bigint; correct: bigint }[]>`
        SELECT "exerciseId",
               COUNT(DISTINCT "userId")                                       AS total,
               COUNT(DISTINCT "userId") FILTER (WHERE "isCorrect" = true)    AS correct
        FROM "ExerciseAttempt"
        WHERE "courseId" = ${courseId}
        GROUP BY "exerciseId"
      `,
      prisma.exerciseAnalysis.findMany({
        where:  { courseId },
        select: {
          exerciseId: true,
          summary: true,
          commonMisconceptions: true,
          attemptCountAtGeneration: true,
          generatedAt: true,
        },
      }),
    ])

    const attemptMap  = new Map(attemptRows.map(r => [r.exerciseId, r]))
    const analysisMap = new Map(analyses.map(a => [a.exerciseId, a]))

    const result: import('@metis/types').GetExerciseAnalyticsResponse = {
      exercises: exercises.map(ex => {
        const att      = attemptMap.get(ex.id)
        const analysis = analysisMap.get(ex.id)
        const total    = att ? Number(att.total) : 0
        const correct  = att ? Number(att.correct) : 0

        let analysisStatus: 'none' | 'ready' | 'stale' = 'none'
        if (analysis) {
          analysisStatus = total > analysis.attemptCountAtGeneration ? 'stale' : 'ready'
        }

        return {
          exerciseId:           ex.id,
          moduleId:             ex.courseModuleId,
          moduleName:           ex.courseModule.name,
          question:             ex.question,
          totalAttempts:        total,
          correctRate:          total > 0 ? correct / total : null,
          analysisStatus,
          generatedAt:          analysis?.generatedAt.toISOString() ?? null,
          summary:              analysis?.summary ?? null,
          commonMisconceptions: analysis
            ? (analysis.commonMisconceptions as string[])
            : null,
        }
      }),
    }

    res.json(result)
  } catch (err) {
    logger.error({ err }, '[GET /api/courses/:id/analytics/exercises]')
    res.status(500).json({ error: 'Failed to fetch exercise analytics' })
  }
})
```

Add the `GetExerciseAnalyticsResponse` import to the top of courses.ts:

```typescript
import {
  GetCourseAnalyticsResponse,
  GetStudentConceptsResponse,
  GetExerciseAnalyticsResponse,
  TriggerAnalysisResponse,
} from '@metis/types'
```

(Replace whatever subset of those was already imported.)

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @metis/api typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/courses.ts
git commit -m "feat: add exercise analytics list endpoint"
```

---

## Task 10: Create `exerciseAnalysis.ts` — LLM analysis library

**Files:**
- Create: `apps/api/src/lib/exerciseAnalysis.ts`
- Create: `apps/api/src/lib/exerciseAnalysis.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/lib/exerciseAnalysis.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma
vi.mock('../db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    exercise: { findUnique: vi.fn() },
    exerciseAttempt: { count: vi.fn() },
    exerciseAnalysis: { upsert: vi.fn() },
  },
}))

// Mock AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn((opts) => opts) },
}))

vi.mock('./llm', () => ({ getModel: vi.fn(() => 'mock-model') }))

import { generateAnalysis } from './exerciseAnalysis'
import { prisma } from '../db'
import { generateText } from 'ai'

const mockPrisma = prisma as ReturnType<typeof vi.mocked<typeof prisma>>

beforeEach(() => vi.clearAllMocks())

describe('generateAnalysis', () => {
  it('calls the LLM with the exercise question and student answers, then upserts the result', async () => {
    // Arrange
    vi.mocked(prisma.exercise.findUnique).mockResolvedValue({
      id: 1,
      question: 'What is the derivative of x^2?',
      courseModuleId: 10,
      courseModule: { courseId: 5 },
    } as any)

    vi.mocked(prisma.exerciseAttempt.count).mockResolvedValue(4)

    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { userId: 'u1', answer: '2x',  isCorrect: true  },
      { userId: 'u2', answer: 'x^2', isCorrect: false },
      { userId: 'u3', answer: '2',   isCorrect: false },
      { userId: 'u4', answer: '2x',  isCorrect: true  },
    ])

    vi.mocked(generateText).mockResolvedValue({
      output: {
        summary: 'Most students understand the power rule.',
        commonMisconceptions: ['Forgetting to reduce the exponent'],
      },
    } as any)

    vi.mocked(prisma.exerciseAnalysis.upsert).mockResolvedValue({
      id: 1,
      exerciseId: 1,
      courseId: 5,
      summary: 'Most students understand the power rule.',
      commonMisconceptions: ['Forgetting to reduce the exponent'],
      attemptCountAtGeneration: 4,
      generatedAt: new Date('2026-01-01'),
    })

    // Act
    const result = await generateAnalysis(1)

    // Assert
    expect(generateText).toHaveBeenCalledOnce()
    expect(prisma.exerciseAnalysis.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where:  { exerciseId: 1 },
        create: expect.objectContaining({ exerciseId: 1, courseId: 5, attemptCountAtGeneration: 4 }),
        update: expect.objectContaining({ attemptCountAtGeneration: 4 }),
      })
    )
    expect(result.summary).toBe('Most students understand the power rule.')
    expect(result.commonMisconceptions).toEqual(['Forgetting to reduce the exponent'])
  })

  it('throws if the exercise is not found', async () => {
    vi.mocked(prisma.exercise.findUnique).mockResolvedValue(null)
    await expect(generateAnalysis(999)).rejects.toThrow('Exercise 999 not found')
  })

  it('throws if there are fewer than 3 distinct student answers', async () => {
    vi.mocked(prisma.exercise.findUnique).mockResolvedValue({
      id: 1, question: 'Q?', courseModuleId: 10, courseModule: { courseId: 5 },
    } as any)
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { userId: 'u1', answer: '2x', isCorrect: true },
    ])
    await expect(generateAnalysis(1)).rejects.toThrow('Not enough answers')
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
cd apps/api && pnpm test -- --reporter=verbose exerciseAnalysis.test
```

Expected: fail with "Cannot find module './exerciseAnalysis'".

- [ ] **Step 3: Check where `prisma` is exported from in the API**

```bash
grep -r "export.*prisma" apps/api/src/
```

Find the path (likely `src/db.ts` or `src/lib/prisma.ts`) — use that in the import below.

- [ ] **Step 4: Create `apps/api/src/lib/exerciseAnalysis.ts`**

```typescript
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { prisma } from '../db'   // adjust path if needed (see Step 3)
import { getModel } from './llm'
import { logger } from './logger'

const AnalysisSchema = z.object({
  summary: z.string(),
  commonMisconceptions: z.array(z.string()),
})

type AnalysisResult = {
  summary: string
  commonMisconceptions: string[]
  generatedAt: Date
  attemptCount: number
}

/**
 * Generates an LLM analysis for a single exercise:
 * 1. Fetches the exercise question.
 * 2. Fetches all distinct student answers (one per student) from ExerciseAttempt.
 * 3. Calls the LLM with structured output to identify patterns and misconceptions.
 * 4. Upserts the result into ExerciseAnalysis.
 *
 * Throws if the exercise is not found or if there are fewer than 3 distinct answers.
 */
export async function generateAnalysis(exerciseId: number): Promise<AnalysisResult> {
  const exercise = await prisma.exercise.findUnique({
    where:  { id: exerciseId },
    select: { id: true, question: true, courseModuleId: true, courseModule: { select: { courseId: true } } },
  })
  if (!exercise) throw new Error(`Exercise ${exerciseId} not found`)

  // One answer per student (DISTINCT ON userId), most recent attempt per student.
  const answers = await prisma.$queryRaw<{ userId: string; answer: string | null; isCorrect: boolean }[]>`
    SELECT DISTINCT ON ("userId") "userId", "answer", "isCorrect"
    FROM "ExerciseAttempt"
    WHERE "exerciseId" = ${exerciseId}
      AND "answer"     IS NOT NULL
    ORDER BY "userId", "createdAt" DESC
  `

  if (answers.length < 3) throw new Error(`Not enough answers for exercise ${exerciseId} (need ≥ 3, got ${answers.length})`)

  const totalAttempts = await prisma.exerciseAttempt.count({ where: { exerciseId } })

  const answerLines = answers
    .map(a => `[${a.isCorrect ? 'CORRECT' : 'INCORRECT'}] "${a.answer ?? ''}"`)
    .join('\n')

  const { output } = await generateText({
    model:  getModel(),
    output: Output.object({ schema: AnalysisSchema }),
    system: [
      'You are an educational data analyst helping a teacher understand how their students performed on an exercise.',
      'Be concise, specific, and practical. Focus on actionable patterns.',
    ].join(' '),
    messages: [{
      role:    'user',
      content: [
        `Exercise: ${exercise.question}`,
        '',
        `Student answers (${answers.length} students):`,
        answerLines,
        '',
        'Provide:',
        '- summary: 2-3 sentences describing overall class performance.',
        '- commonMisconceptions: up to 5 specific patterns observed in incorrect answers. If most answers are correct, note what students got right.',
      ].join('\n'),
    }],
  })

  const parsed = output as z.infer<typeof AnalysisSchema>

  const saved = await prisma.exerciseAnalysis.upsert({
    where:  { exerciseId },
    create: {
      exerciseId,
      courseId:                exercise.courseModule.courseId,
      summary:                 parsed.summary,
      commonMisconceptions:    parsed.commonMisconceptions,
      attemptCountAtGeneration: totalAttempts,
    },
    update: {
      summary:                 parsed.summary,
      commonMisconceptions:    parsed.commonMisconceptions,
      attemptCountAtGeneration: totalAttempts,
      generatedAt:             new Date(),
    },
  })

  logger.info({ exerciseId, answerCount: answers.length }, '[exerciseAnalysis] generated')

  return {
    summary:              saved.summary,
    commonMisconceptions: saved.commonMisconceptions as string[],
    generatedAt:          saved.generatedAt,
    attemptCount:         totalAttempts,
  }
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
cd apps/api && pnpm test -- --reporter=verbose exerciseAnalysis.test
```

Expected: all 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/lib/exerciseAnalysis.ts apps/api/src/lib/exerciseAnalysis.test.ts
git commit -m "feat: add exerciseAnalysis library with LLM-powered analysis and tests"
```

---

## Task 11: Add `POST /api/courses/:id/analytics/exercises/:exerciseId/analyze` endpoint

**Files:**
- Modify: `apps/api/src/routes/courses.ts`

- [ ] **Step 1: Import `generateAnalysis`**

Add to the imports at the top of courses.ts:

```typescript
import { generateAnalysis } from '../lib/exerciseAnalysis'
```

- [ ] **Step 2: Add the on-demand trigger route**

Insert directly after the exercise list route added in Task 9:

```typescript
// POST /api/courses/:id/analytics/exercises/:exerciseId/analyze
// On-demand trigger for LLM analysis. Used in dev and for manual teacher refresh.
router.post('/:id/analytics/exercises/:exerciseId/analyze', requireAuth, async (req, res) => {
  const courseId   = parseInt(req.params.id as string)
  const exerciseId = parseInt(req.params.exerciseId as string)
  if (isNaN(courseId) || isNaN(exerciseId)) {
    res.status(400).json({ error: 'Invalid IDs' }); return
  }

  try {
    // Verify course ownership and that the exercise belongs to this course
    const exercise = await prisma.exercise.findFirst({
      where:  { id: exerciseId, courseModule: { courseId } },
      select: { id: true },
    })
    const course = await prisma.course.findFirst({
      where:  { id: courseId, teacherId: req.user!.id },
      select: { id: true },
    })
    if (!course || !exercise) {
      res.status(404).json({ error: 'Exercise not found in this course' }); return
    }

    const result = await generateAnalysis(exerciseId)

    const response: TriggerAnalysisResponse = {
      exerciseId,
      summary:              result.summary,
      commonMisconceptions: result.commonMisconceptions,
      generatedAt:          result.generatedAt.toISOString(),
    }
    res.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('Not enough answers')) {
      res.status(422).json({ error: message }); return
    }
    logger.error({ err }, '[POST /api/courses/:id/analytics/exercises/:exerciseId/analyze]')
    res.status(500).json({ error: 'Analysis failed' })
  }
})
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @metis/api typecheck
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/courses.ts
git commit -m "feat: add on-demand exercise analysis endpoint"
```

---

## Task 12: Frontend — `ConceptBreakdownSection`

**Files:**
- Create: `apps/web/src/app/teacher/courses/[id]/analytics/ConceptBreakdownSection.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { ConceptBreakdownItem } from '@metis/types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  concepts: ConceptBreakdownItem[]
}

export default function ConceptBreakdownSection({ concepts }: Props) {
  if (concepts.length === 0) return null

  // Only show concepts that have at least one attempt
  const data = concepts.map(c => ({
    name:          c.conceptName.length > 24 ? c.conceptName.slice(0, 22) + '…' : c.conceptName,
    fullName:      c.conceptName,
    incorrectRate: Math.round(c.incorrectRate * 100),
    total:         c.totalAttempts,
  }))

  return (
    <div className="mb-8">
      <p className="text-sm font-semibold text-gray-900 mb-1">Concept difficulty</p>
      <p className="text-xs text-gray-400 mb-4">Ranked by share of incorrect attempts — concepts at the top need the most classroom attention.</p>
      <ResponsiveContainer width="100%" height={Math.max(120, data.length * 28)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 11, fill: '#374151' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: '#f9fafb' }}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
            formatter={(value: number, _name: string, props: any) => [
              `${value}% incorrect (${props.payload.total} attempts)`,
              props.payload.fullName,
            ]}
          />
          <Bar dataKey="incorrectRate" fill="#dc2626" radius={[0, 4, 4, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm --filter @metis/web typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/teacher/courses/[id]/analytics/
git commit -m "feat: add ConceptBreakdownSection analytics component"
```

---

## Task 13: Frontend — `StudentTable` with drilldown

**Files:**
- Create: `apps/web/src/app/teacher/courses/[id]/analytics/StudentTable.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'
import { CourseAnalyticsStudent, StudentConceptDetail, GetStudentConceptsResponse } from '@metis/types'
import { apiFetch } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL

type SortKey = 'email' | 'progress' | 'lastActiveAt'
type SortDir = 'asc' | 'desc'

function formatLastActive(iso: string | null): string {
  if (!iso) return 'Never'
  const diffMs  = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  const hours   = Math.floor(diffMs / 3_600_000)
  if (minutes < 1)  return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24)   return `${hours}h ago`
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function sortStudents(students: CourseAnalyticsStudent[], sortBy: SortKey, sortDir: SortDir) {
  return [...students].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'email') {
      cmp = a.email.localeCompare(b.email)
    } else if (sortBy === 'progress') {
      if (a.progress === null && b.progress === null) return 0
      if (a.progress === null) return 1
      if (b.progress === null) return -1
      cmp = a.progress - b.progress
    } else {
      if (!a.lastActiveAt && !b.lastActiveAt) return 0
      if (!a.lastActiveAt) return 1
      if (!b.lastActiveAt) return -1
      cmp = new Date(a.lastActiveAt).getTime() - new Date(b.lastActiveAt).getTime()
    }
    return sortDir === 'asc' ? cmp : -cmp
  })
}

function SortIcon({ col, sortBy, sortDir }: { col: SortKey; sortBy: SortKey; sortDir: SortDir }) {
  if (col !== sortBy) return <span className="text-gray-300 ml-1">↕</span>
  return <span className="text-primary ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

function ConceptDrilldown({ courseId, userId }: { courseId: number; userId: string }) {
  const [concepts, setConceptData]  = useState<StudentConceptDetail[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  if (!concepts && !loading && !error) {
    // Fetch on first render of expanded row
    setLoading(true)
    apiFetch(`${API}/api/courses/${courseId}/analytics/students/${userId}/concepts`)
      .then(r => r.json() as Promise<GetStudentConceptsResponse>)
      .then(data => { setConceptData(data.concepts); setLoading(false) })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }

  if (loading) return <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
  if (error)   return <p className="text-xs text-red-500">{error}</p>
  if (!concepts || concepts.length === 0) return <p className="text-xs text-gray-400">No concept data yet.</p>

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
      {concepts.map(c => (
        <div key={c.conceptId} className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-xs text-gray-500 truncate mb-1">{c.conceptName}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-primary"
                style={{ width: `${Math.round(c.effectiveScore ?? 0)}%` }}
              />
            </div>
            <span className="text-xs text-gray-700 w-8 text-right shrink-0">
              {c.effectiveScore !== null ? `${Math.round(c.effectiveScore)}%` : '—'}
            </span>
          </div>
          {c.totalAttempts > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              {c.totalAttempts} attempt{c.totalAttempts !== 1 ? 's' : ''}{c.correctRate !== null ? `, ${Math.round(c.correctRate * 100)}% correct` : ''}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

interface Props {
  courseId: number
  students: CourseAnalyticsStudent[]
}

export default function StudentTable({ courseId, students }: Props) {
  const [sortBy,      setSortBy]      = useState<SortKey>('lastActiveAt')
  const [sortDir,     setSortDir]     = useState<SortDir>('desc')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  function handleSort(key: SortKey) {
    if (key === sortBy) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(key)
      setSortDir(key === 'email' ? 'asc' : 'desc')
    }
  }

  const sorted = sortStudents(students, sortBy, sortDir)

  return (
    <div>
      <div className="flex items-baseline justify-between mb-5">
        <p className="text-sm font-semibold text-gray-900">Student progress</p>
        <p className="text-sm text-gray-400">{students.length} student{students.length !== 1 ? 's' : ''} enrolled</p>
      </div>

      {students.length === 0 ? (
        <p className="text-sm text-gray-400">No students enrolled in this course yet.</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_140px_24px] bg-gray-50 border-b border-gray-200 px-4 py-2">
            {(
              [
                { key: 'email',        label: 'Student'     },
                { key: 'progress',     label: 'Progress'    },
                { key: 'lastActiveAt', label: 'Last active' },
              ] as { key: SortKey; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSort(key)}
                className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600 transition-colors flex items-center"
              >
                {label}
                <SortIcon col={key} sortBy={sortBy} sortDir={sortDir} />
              </button>
            ))}
            <div />
          </div>

          {sorted.map((student, i) => {
            const expanded = expandedRow === student.userId
            return (
              <div key={student.userId}>
                <button
                  onClick={() => setExpandedRow(expanded ? null : student.userId)}
                  className={`w-full grid grid-cols-[1fr_100px_140px_24px] px-4 py-3 items-center text-sm text-left ${
                    i < sorted.length - 1 || expanded ? 'border-b border-gray-100' : ''
                  } hover:bg-gray-50 transition-colors`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {student.atRisk && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-amber-400" title="At risk" />
                    )}
                    <span className="text-gray-800 truncate">{student.email}</span>
                  </span>
                  <span className="text-gray-800">
                    {student.progress === null ? '—' : `${Math.round(student.progress)}%`}
                  </span>
                  <span className="text-gray-500">{formatLastActive(student.lastActiveAt)}</span>
                  <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
                </button>
                {expanded && (
                  <div className="px-4 pb-4 pt-2 bg-gray-50 border-b border-gray-100">
                    <ConceptDrilldown courseId={courseId} userId={student.userId} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {sorted.some(s => s.atRisk) && (
        <p className="text-xs text-gray-400 mt-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />
          At-risk: progress below 50% and no activity in the last 7 days.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @metis/web typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/teacher/courses/[id]/analytics/StudentTable.tsx
git commit -m "feat: add StudentTable with at-risk indicators and concept drilldown"
```

---

## Task 14: Frontend — `ExerciseAnalysisSection`

**Files:**
- Create: `apps/web/src/app/teacher/courses/[id]/analytics/ExerciseAnalysisSection.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'
import { ExerciseAnalysisSummary, GetExerciseAnalyticsResponse, TriggerAnalysisResponse } from '@metis/types'
import { apiFetch } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL

function AnalysisStatusBadge({ status }: { status: ExerciseAnalysisSummary['analysisStatus'] }) {
  if (status === 'none')  return <span className="text-xs text-gray-400">Not analysed</span>
  if (status === 'stale') return <span className="text-xs text-amber-500">Stale</span>
  return <span className="text-xs text-green-600">Ready</span>
}

interface Props {
  courseId: number
  exercises: ExerciseAnalysisSummary[]
}

export default function ExerciseAnalysisSection({ courseId, exercises }: Props) {
  const [selected,    setSelected]    = useState<number | null>(exercises[0]?.exerciseId ?? null)
  const [analysisMap, setAnalysisMap] = useState<Record<number, Partial<ExerciseAnalysisSummary>>>({})
  const [triggering,  setTriggering]  = useState<number | null>(null)
  const [triggerError, setTriggerError] = useState<string | null>(null)

  async function triggerAnalysis(exerciseId: number) {
    setTriggering(exerciseId)
    setTriggerError(null)
    try {
      const res = await apiFetch(`${API}/api/courses/${courseId}/analytics/exercises/${exerciseId}/analyze`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Analysis failed')
      }
      const data: TriggerAnalysisResponse = await res.json()
      setAnalysisMap(m => ({
        ...m,
        [exerciseId]: {
          summary:              data.summary,
          commonMisconceptions: data.commonMisconceptions,
          generatedAt:          data.generatedAt,
          analysisStatus:       'ready',
        },
      }))
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setTriggering(null)
    }
  }

  if (exercises.length === 0) return null

  const selectedExercise = exercises.find(e => e.exerciseId === selected)
  const overrides        = selected ? analysisMap[selected] : {}
  const mergedExercise   = selectedExercise ? { ...selectedExercise, ...overrides } : null

  // Group exercises by module for the sidebar
  const byModule = exercises.reduce<Record<string, ExerciseAnalysisSummary[]>>((acc, ex) => {
    const key = ex.moduleName
    if (!acc[key]) acc[key] = []
    acc[key].push(ex)
    return acc
  }, {})

  return (
    <div className="mb-8">
      <p className="text-sm font-semibold text-gray-900 mb-4">Exercise analysis</p>
      <div className="border border-gray-200 rounded-xl overflow-hidden flex min-h-[320px]">
        {/* Sidebar */}
        <div className="w-56 shrink-0 border-r border-gray-100 overflow-y-auto">
          {Object.entries(byModule).map(([moduleName, exs]) => (
            <div key={moduleName}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-3 pt-3 pb-1">
                {moduleName}
              </p>
              {exs.map(ex => {
                const override = analysisMap[ex.exerciseId]
                const status   = override?.analysisStatus ?? ex.analysisStatus
                return (
                  <button
                    key={ex.exerciseId}
                    onClick={() => setSelected(ex.exerciseId)}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                      selected === ex.exerciseId ? 'bg-gray-100' : ''
                    }`}
                  >
                    <p className="text-xs text-gray-700 line-clamp-2 mb-0.5">
                      {ex.question}
                    </p>
                    <div className="flex items-center gap-2">
                      <AnalysisStatusBadge status={status ?? 'none'} />
                      {ex.totalAttempts > 0 && (
                        <span className="text-xs text-gray-400">
                          {ex.totalAttempts} student{ex.totalAttempts !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Detail pane */}
        <div className="flex-1 p-5 overflow-y-auto">
          {!mergedExercise ? (
            <p className="text-sm text-gray-400">Select an exercise.</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900 mb-1">{mergedExercise.question}</p>
              <div className="flex items-center gap-3 mb-4 text-xs text-gray-400">
                <span>{mergedExercise.totalAttempts} student{mergedExercise.totalAttempts !== 1 ? 's' : ''}</span>
                {mergedExercise.correctRate !== null && (
                  <span>{Math.round(mergedExercise.correctRate * 100)}% correct</span>
                )}
                {mergedExercise.generatedAt && (
                  <span>Analysed {new Date(mergedExercise.generatedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                )}
              </div>

              {mergedExercise.summary ? (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Summary</p>
                  <p className="text-sm text-gray-700">{mergedExercise.summary}</p>
                </div>
              ) : null}

              {mergedExercise.commonMisconceptions && mergedExercise.commonMisconceptions.length > 0 ? (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Common patterns</p>
                  <ul className="space-y-1">
                    {mergedExercise.commonMisconceptions.map((m, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="text-gray-300 shrink-0">•</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(mergedExercise.analysisStatus === 'none' || mergedExercise.analysisStatus === 'stale') && (
                <div>
                  <button
                    onClick={() => triggerAnalysis(mergedExercise.exerciseId)}
                    disabled={triggering === mergedExercise.exerciseId}
                    className="text-xs font-medium text-primary border border-primary rounded-lg px-3 py-1.5 hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {triggering === mergedExercise.exerciseId
                      ? 'Analysing…'
                      : mergedExercise.analysisStatus === 'stale'
                      ? 'Refresh analysis'
                      : 'Request analysis'}
                  </button>
                  {triggerError && (
                    <p className="text-xs text-red-500 mt-1">{triggerError}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @metis/web typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/teacher/courses/[id]/analytics/ExerciseAnalysisSection.tsx
git commit -m "feat: add ExerciseAnalysisSection with LLM analysis display and on-demand trigger"
```

---

## Task 15: Wire up `AnalyticsTab.tsx`

**Files:**
- Modify: `apps/web/src/app/teacher/courses/[id]/AnalyticsTab.tsx`

- [ ] **Step 1: Replace the contents of AnalyticsTab.tsx with the composed version**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import {
  GetCourseAnalyticsResponse,
  GetExerciseAnalyticsResponse,
} from '@metis/types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import ConceptBreakdownSection from './analytics/ConceptBreakdownSection'
import StudentTable from './analytics/StudentTable'
import ExerciseAnalysisSection from './analytics/ExerciseAnalysisSection'

const API = process.env.NEXT_PUBLIC_API_URL

function AttemptsChart({
  data,
  granularity,
}: {
  data: GetCourseAnalyticsResponse['attemptsOverTime']
  granularity: 'hour' | 'day' | 'week'
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 rounded-xl border border-gray-200 bg-gray-50 mb-8">
        <p className="text-sm text-gray-400">No exercise attempts yet.</p>
      </div>
    )
  }

  function formatTick(d: string): string {
    const date = new Date(d)
    if (granularity === 'hour') {
      return date.toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric' })
    }
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }

  function formatLabel(d: unknown): string {
    const date = new Date(String(d))
    if (granularity === 'hour') {
      return date.toLocaleString('en', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    }
    if (granularity === 'week') {
      return `Week of ${date.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}`
    }
    return date.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="mb-8">
      <p className="text-sm font-semibold text-gray-900 mb-4">Exercise attempts over time</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={formatTick} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} labelFormatter={formatLabel} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Line type="monotone" dataKey="total"     name="Total"     stroke="#111827" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="correct"   name="Correct"   stroke="#16a34a" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="incorrect" name="Incorrect" stroke="#dc2626" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface Props {
  courseId: number
}

export default function AnalyticsTab({ courseId }: Props) {
  const [analytics,  setAnalytics]  = useState<GetCourseAnalyticsResponse | null>(null)
  const [exercises,  setExercises]  = useState<GetExerciseAnalyticsResponse | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const [analyticsRes, exercisesRes] = await Promise.all([
          apiFetch(`${API}/api/courses/${courseId}/analytics`, { signal: controller.signal }),
          apiFetch(`${API}/api/courses/${courseId}/analytics/exercises`, { signal: controller.signal }),
        ])
        if (!analyticsRes.ok || !exercisesRes.ok) throw new Error('Failed to load analytics')
        const [analyticsData, exercisesData] = await Promise.all([
          analyticsRes.json() as Promise<GetCourseAnalyticsResponse>,
          exercisesRes.json() as Promise<GetExerciseAnalyticsResponse>,
        ])
        setAnalytics(analyticsData)
        setExercises(exercisesData)
        setLoading(false)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError('Could not load analytics. Please try again.')
        setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [courseId])

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-[232px] bg-gray-100 rounded-xl animate-pulse mb-8" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) return <p className="text-sm text-red-500">{error}</p>
  if (!analytics || !exercises) return null

  return (
    <div>
      <AttemptsChart data={analytics.attemptsOverTime} granularity={analytics.granularity} />
      <ConceptBreakdownSection concepts={analytics.conceptBreakdown} />
      <StudentTable courseId={courseId} students={analytics.students} />
      <div className="mt-8">
        <ExerciseAnalysisSection courseId={courseId} exercises={exercises.exercises} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck the full web app**

```bash
pnpm --filter @metis/web typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/teacher/courses/[id]/AnalyticsTab.tsx
git commit -m "feat: compose analytics tab with concept breakdown, student drilldown, and exercise analysis"
```

---

## Self-Review

**Spec coverage:**
- ✅ Class concept diagnostics — Task 7 (backend query) + Task 13 (ConceptBreakdownSection)
- ✅ Per-student concept drilldown — Task 8 (endpoint) + Task 14 (StudentTable)
- ✅ At-risk flagging — Task 6 (`computeAtRisk`) + Task 14 (amber dot in StudentTable)
- ✅ Exercise answer capture — Task 5 (session.ts `answerText`)
- ✅ Exercise list with attempt stats — Task 9 (endpoint) + Task 15 (ExerciseAnalysisSection sidebar)
- ✅ LLM analysis generation — Task 10 (`exerciseAnalysis.ts`)
- ✅ On-demand analysis trigger — Task 11 (endpoint) + Task 15 (button in detail pane)
- ✅ Scheduled weekly batch job — Task 12 (`analyzeExercises.ts` + cron registration)
- ✅ Schema changes — Tasks 2 and 3

**Placeholder scan:** No TBD/TODO markers. All steps contain complete code.

**Type consistency:**
- `computeAtRisk(progress: number | null, lastActiveAt: string | null): boolean` — defined Task 6, used Task 7 ✅
- `generateAnalysis(exerciseId: number): Promise<AnalysisResult>` — defined Task 10, used Tasks 11 + 12 ✅
- `CourseAnalyticsStudent.userId` — added Task 4, consumed Task 14 ✅
- `ConceptBreakdownItem[]` — returned by analytics endpoint Task 7, consumed Task 13 ✅
- `GetExerciseAnalyticsResponse` — defined Task 4, returned Task 9, consumed Tasks 15 + 16 ✅
