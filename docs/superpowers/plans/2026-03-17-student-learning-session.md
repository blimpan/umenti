# Student Learning Session Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the end-to-end student learning session: DB tables, session API (4 endpoints with SSE streaming and AI tutoring), and a fully-wired frontend chat shell.

**Architecture:** A new Express route mounted at `/api/student/courses/:courseId/modules/:moduleId/session` handles all session logic. The frontend calls `GET /session` on load to hydrate state, then opens SSE streams via `fetch` (not `EventSource`, since POST endpoints need streams too). The AI is called statelessly — every request assembles its own context from the DB. System events (exercise cards, theory blocks) are written to the DB before the SSE stream begins so they survive disconnects.

**Tech Stack:** Prisma (schema changes + migrations), Express + SSE (`res.write` / `res.flushHeaders`), Anthropic SDK (already used in `courseGeneration.ts`), React (`useState` / `useEffect`), TypeScript discriminated unions for SSE events.

**Spec:** `docs/design-specs/student-learning-session.md`

**Key conventions:**
- `NEXT_PUBLIC_API_URL` — base URL for API calls from the browser
- `requireAuth` middleware in `apps/api/src/middleware/auth.ts` — always use this; attaches `req.user.id`
- New routes go in `apps/api/src/routes/`, registered in `apps/api/src/index.ts`
- Shared types in `packages/types/src/index.ts`
- `mergeParams: true` is required when mounting a router with parent path params (e.g. `:courseId`)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `apps/api/prisma/schema.prisma` | Modify | Add `ModuleSession`, `ChatMessage`, `Exercise.source` |
| `apps/api/src/lib/decay.ts` | Create | Extracted `applyDecay` utility (was inline in student.ts) |
| `apps/api/src/routes/student.ts` | Modify | Import decay from lib |
| `apps/api/src/routes/session.ts` | Create | All 4 session endpoints |
| `apps/api/src/index.ts` | Modify | Register session router |
| `packages/types/src/index.ts` | Modify | Add session types |
| `apps/web/.../session/SessionShell.tsx` | Rewrite | Page load, SSE wiring, message rendering |
| `apps/web/.../session/ExerciseCard.tsx` | Modify | Accept `onSubmit` callback + `result` prop |
| `apps/web/.../session/MultipleChoiceExercise.tsx` | Modify | Call `onSubmit`, show result from prop |
| `apps/web/.../session/FreeTextExercise.tsx` | Modify | Call `onSubmit`, show result from prop |

---

## Task 1: DB Schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] Add `ExerciseSource` enum and `source` field to `Exercise`

```prisma
enum ExerciseSource {
  TEACHER_PROVIDED
  AI_PROVIDED
}

// In model Exercise, add:
source ExerciseSource @default(TEACHER_PROVIDED)
```

- [ ] Add `MessageRole` and `MessageType` enums

```prisma
enum MessageRole {
  AI
  STUDENT
  SYSTEM
}

enum MessageType {
  TEXT
  THEORY_BLOCK
  EXERCISE_CARD
  PRIOR_KNOWLEDGE_QUESTION
  SYSTEM_MESSAGE
  CONCEPT_MASTERY_REACHED
  MODULE_END_REACHED
}
```

- [ ] Add `ModuleSession` model

```prisma
model ModuleSession {
  id       String  @id @default(uuid())
  userId   String
  student  StudentProfile @relation(fields: [userId], references: [userId], onDelete: Cascade)
  moduleId Int
  module   CourseModule   @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  messages ChatMessage[]

  @@unique([userId, moduleId])
}
```

- [ ] Add `ChatMessage` model

```prisma
model ChatMessage {
  id        String        @id @default(uuid())
  sessionId String
  session   ModuleSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  role      MessageRole
  type      MessageType
  payload   Json
  order     Int
  createdAt DateTime @default(now())
}
```

- [ ] Add back-relations to `StudentProfile`, `CourseModule`

```prisma
// In model StudentProfile, add:
moduleSessions ModuleSession[]

// In model CourseModule, add:
sessions ModuleSession[]
```

- [ ] Run migration: `cd apps/api && npx prisma migrate dev --name add_session_tables`

- [ ] Verify: `npx prisma generate` outputs no errors

- [ ] Commit: `git add apps/api/prisma && git commit -m "feat: add ModuleSession and ChatMessage tables"`

---

## Task 2: Shared Types

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] Add `StudentExercise`, `ExerciseResult`, `ChatMessage`, `SseEvent`, `GetSessionResponse`

```ts
// --- Learning session ---

// Server strips answer fields before sending to client
export type StudentExercise = Omit<CourseExercise, 'correctIndex' | 'sampleAnswer' | 'rubric'>

export type ExerciseResult = {
  correct: boolean
  scoreChange: number
  feedback: string
}

// Discriminated union — type narrows the payload shape
export type ChatMessage = {
  id: string
  sessionId: string
  role: 'AI' | 'STUDENT' | 'SYSTEM'
  order: number
  createdAt: string
} & (
  | { type: 'TEXT';                    payload: { content: string } }
  | { type: 'SYSTEM_MESSAGE';          payload: { content: string } }
  | { type: 'THEORY_BLOCK';            payload: { conceptId: number; blocks: string[] } }
  | { type: 'EXERCISE_CARD';           payload: { exerciseId: number; submitted: boolean; result?: ExerciseResult } }
  | { type: 'PRIOR_KNOWLEDGE_QUESTION'; payload: { exerciseId: number; submitted: boolean; result?: ExerciseResult } }
  | { type: 'CONCEPT_MASTERY_REACHED'; payload: { conceptId: number; newEffectiveScore: number } }
  | { type: 'MODULE_END_REACHED';      payload: { conceptScores: { conceptId: number; effectiveScore: number }[]; nextModuleId?: number } }
)

export type SseEvent =
  | { type: 'token';                           content: string }
  | { type: 'system:message';                  payload: { content: string } }
  | { type: 'system:theory_block';             payload: { conceptId: number; blocks: string[] } }
  | { type: 'system:exercise_card';            payload: { exerciseId: number; exercise: StudentExercise } }
  | { type: 'system:prior_knowledge_question'; payload: { exerciseId: number; exercise: StudentExercise } }
  | { type: 'system:exercise_submitted';       payload: { exerciseId: number; result: ExerciseResult } }
  | { type: 'system:concept_mastery_reached';  payload: { conceptId: number; newEffectiveScore: number } }
  | { type: 'system:module_end_reached';       payload: { conceptScores: { conceptId: number; effectiveScore: number }[]; nextModuleId?: number } }
  | { type: 'done' }

export type GetSessionResponse = {
  session: { id: string; createdAt: string }
  messages: ChatMessage[]
  exercises: Record<string, StudentExercise>
  module: {
    concepts: { id: number; name: string; order: number }[]
    theoryBlocks: Record<string, { id: number; content: string; order: number }[]>
  }
}
```

- [ ] Commit: `git add packages/types && git commit -m "feat: add session types to shared package"`

---

## Task 3: Extract Decay Utility

**Files:**
- Create: `apps/api/src/lib/decay.ts`
- Modify: `apps/api/src/routes/student.ts`

The decay function is currently duplicated inline in `student.ts`. Extract it so the session route can use it too.

- [ ] Create `apps/api/src/lib/decay.ts`

```ts
// SCORE_DECAY_UNIT controls the time unit for the 10%-per-unit decay formula.
// Set to 'minutes' in development to observe decay quickly; leave unset (defaults
// to 'weeks') in production.
export const DECAY_UNIT_MS = process.env.SCORE_DECAY_UNIT === 'minutes'
  ? 60 * 1000
  : 7 * 24 * 60 * 60 * 1000

/**
 * Applies time-based decay to a raw score.
 * effectiveScore = score × (0.9 ^ unitsSinceLastActivity)
 * Returned value is rounded to 1 decimal place.
 */
export function applyDecay(score: number, lastActivityAt: Date): number {
  const unitsSince = (Date.now() - lastActivityAt.getTime()) / DECAY_UNIT_MS
  return Math.round(score * Math.pow(0.9, unitsSince) * 10) / 10
}
```

- [ ] Update `apps/api/src/routes/student.ts` to import from `../lib/decay`

Replace the two inline constants `DECAY_UNIT_MS` / `effectiveScore` computation with:
```ts
import { applyDecay } from '../lib/decay'
// then in the route: effectiveScore: applyDecay(r.score, r.lastActivityAt)
```

- [ ] Verify dev server still starts: `pnpm --filter api dev`

- [ ] Commit: `git add apps/api/src && git commit -m "refactor: extract applyDecay to shared lib"`

---

## Task 4: GET /session Endpoint

**Files:**
- Create: `apps/api/src/routes/session.ts`

This endpoint upserts the session and returns all the data the client needs to hydrate.

- [ ] Create `apps/api/src/routes/session.ts` with the router skeleton

```ts
import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { applyDecay } from '../lib/decay'
import { GetSessionResponse, StudentExercise } from '@metis/types'

const router = Router({ mergeParams: true })  // mergeParams exposes :courseId and :moduleId from parent
const prisma = new PrismaClient()

export default router
```

- [ ] Implement GET `/`

```ts
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const moduleId = parseInt(req.params.moduleId)
  const courseId = parseInt(req.params.courseId)
  if (isNaN(moduleId) || isNaN(courseId)) {
    res.status(400).json({ error: 'Invalid module or course ID' }); return
  }

  try {
    // Verify the student is enrolled in this course
    const enrollment = await prisma.enrollment.findFirst({
      where: { courseId, userId: req.user!.id, status: 'ACTIVE' },
    })
    if (!enrollment) { res.status(403).json({ error: 'Not enrolled' }); return }

    // Upsert: create session if first visit, return existing if returning
    const session = await prisma.moduleSession.upsert({
      where:  { userId_moduleId: { userId: req.user!.id, moduleId } },
      create: { userId: req.user!.id, moduleId },
      update: {},
    })

    // Load chat history, ordered by explicit sequence
    const messages = await prisma.chatMessage.findMany({
      where:   { sessionId: session.id },
      orderBy: { order: 'asc' },
    })

    // Load all exercises for this module, strip answer fields
    const rawExercises = await prisma.exercise.findMany({
      where:   { courseModuleId: moduleId },
      include: { conceptLinks: true },
      orderBy: { order: 'asc' },
    })

    const exercises: Record<string, StudentExercise> = {}
    for (const ex of rawExercises) {
      exercises[ex.id] = {
        id: ex.id,
        type: ex.type,
        question: ex.question,
        order: ex.order,
        pendingRevision: ex.pendingRevision,
        conceptIds: ex.conceptLinks.map(cl => cl.conceptId),
        options: ex.options as string[] | null,
        explanation: ex.explanation,
      }
    }

    // Load module concepts and theory blocks for the materials panel
    const conceptLinks = await prisma.moduleConcept.findMany({
      where:   { moduleId },
      orderBy: { order: 'asc' },
      include: {
        concept: {
          include: { theoryBlocks: { orderBy: { order: 'asc' } } }
        }
      }
    })

    const theoryBlocks: Record<string, { id: number; content: string; order: number }[]> = {}
    for (const cl of conceptLinks) {
      theoryBlocks[cl.conceptId] = cl.concept.theoryBlocks.map(tb => ({
        id: tb.id, content: tb.content, order: tb.order,
      }))
    }

    const result: GetSessionResponse = {
      session: { id: session.id, createdAt: session.createdAt.toISOString() },
      messages: messages.map(m => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role as 'AI' | 'STUDENT' | 'SYSTEM',
        type: m.type as any,
        payload: m.payload as any,
        order: m.order,
        createdAt: m.createdAt.toISOString(),
      })),
      exercises,
      module: {
        concepts: conceptLinks.map(cl => ({
          id: cl.conceptId,
          name: cl.concept.name,
          order: cl.order,
        })),
        theoryBlocks,
      },
    }

    res.json(result)
  } catch (err) {
    console.error('[GET /session]', err)
    res.status(500).json({ error: 'Failed to load session' })
  }
})
```

- [ ] Commit: `git add apps/api/src/routes/session.ts && git commit -m "feat: add GET /session endpoint"`

---

## Task 5: POST /session/advance — Phase 1

**Files:**
- Modify: `apps/api/src/routes/session.ts`

`advance` is called when the client has no `activeExercise`. It detects which phase the student is in and emits the next SSE event(s).

- [ ] Add the SSE helper at the top of the file (after imports)

```ts
import type { Response } from 'express'
import type { SseEvent } from '@metis/types'

function sseOpen(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()
}

function sseEmit(res: Response, event: SseEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`)
}
```

- [ ] Add the `nextOrder` helper (session-scoped sequence counter)

```ts
async function nextOrder(sessionId: string): Promise<number> {
  const last = await prisma.chatMessage.findFirst({
    where: { sessionId },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  return (last?.order ?? -1) + 1
}
```

- [ ] Add `toStudentExercise` helper

```ts
function toStudentExercise(ex: {
  id: number; type: any; question: string; order: number;
  pendingRevision: boolean; options: any; explanation: string | null;
  conceptLinks: { conceptId: number }[]
}): StudentExercise {
  return {
    id: ex.id, type: ex.type, question: ex.question, order: ex.order,
    pendingRevision: ex.pendingRevision,
    conceptIds: ex.conceptLinks.map(cl => cl.conceptId),
    options: ex.options as string[] | null,
    explanation: ex.explanation,
  }
}
```

- [ ] Implement `POST /advance`

```ts
router.post('/advance', requireAuth, async (req: Request, res: Response) => {
  const moduleId = parseInt(req.params.moduleId)
  if (isNaN(moduleId)) { res.status(400).json({ error: 'Invalid module ID' }); return }

  try {
    const session = await prisma.moduleSession.findUnique({
      where: { userId_moduleId: { userId: req.user!.id, moduleId } },
    })
    if (!session) { res.status(404).json({ error: 'Session not found' }); return }

    const history = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { order: 'asc' },
    })

    const pkqMessages = history.filter(m => m.type === 'PRIOR_KNOWLEDGE_QUESTION')
    const noPkqs = pkqMessages.length === 0

    sseOpen(res)

    if (noPkqs) {
      // ── Phase 1: select up to 3 random exercises and emit the first ──
      const allExercises = await prisma.exercise.findMany({
        where: { courseModuleId: moduleId },
        include: { conceptLinks: true },
        orderBy: { order: 'asc' },
      })

      const pool = allExercises.sort(() => Math.random() - 0.5).slice(0, Math.min(3, allExercises.length))

      // Persist all selected PKQs upfront (not submitted yet)
      for (const ex of pool) {
        const order = await nextOrder(session.id)
        await prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            role: 'SYSTEM',
            type: 'PRIOR_KNOWLEDGE_QUESTION',
            payload: { exerciseId: ex.id, submitted: false },
            order,
          },
        })
      }

      // Emit only the first one
      const first = pool[0]
      if (first) {
        sseEmit(res, {
          type: 'system:prior_knowledge_question',
          payload: { exerciseId: first.id, exercise: toStudentExercise(first) },
        })
      }

      sseEmit(res, { type: 'done' })
      res.end()
      return
    }

    // Check Phase 1 completion: all PKQs submitted
    const allPkqsSubmitted = pkqMessages.every(m => (m.payload as any).submitted === true)

    if (!allPkqsSubmitted) {
      // ── Phase 1 resumption: find next unsubmitted PKQ ──
      const nextPkq = pkqMessages.find(m => (m.payload as any).submitted === false)
      if (nextPkq) {
        const exerciseId = (nextPkq.payload as any).exerciseId
        const ex = await prisma.exercise.findUnique({
          where: { id: exerciseId },
          include: { conceptLinks: true },
        })
        if (ex) {
          sseEmit(res, {
            type: 'system:prior_knowledge_question',
            payload: { exerciseId: ex.id, exercise: toStudentExercise(ex) },
          })
        }
      }
      sseEmit(res, { type: 'done' })
      res.end()
      return
    }

    // ── Phase 2 re-entry ──
    // Emit a resumption message, then find the first concept with effectiveScore < 90
    // that still has unplayed exercises.
    const conceptLinks = await prisma.moduleConcept.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
      include: {
        concept: {
          include: {
            theoryBlocks: { orderBy: { order: 'asc' } },
            exerciseLinks: {
              include: {
                exercise: { include: { conceptLinks: true } }
              }
            },
            progressEntries: { where: { userId: req.user!.id } },
          }
        }
      }
    })

    const usedExerciseIds = new Set(
      history
        .filter(m => m.type === 'EXERCISE_CARD' || m.type === 'PRIOR_KNOWLEDGE_QUESTION')
        .map(m => (m.payload as any).exerciseId as number)
    )

    const theoryConceptsInHistory = new Set(
      history.filter(m => m.type === 'THEORY_BLOCK').map(m => (m.payload as any).conceptId as number)
    )

    // Emit the "resuming" system message
    const smOrder = await nextOrder(session.id)
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id, role: 'SYSTEM', type: 'SYSTEM_MESSAGE',
        payload: { content: 'Resuming where you left off.' },
        order: smOrder,
      },
    })
    sseEmit(res, { type: 'system:message', payload: { content: 'Resuming where you left off.' } })

    for (const cl of conceptLinks) {
      const progress = cl.concept.progressEntries[0]
      const rawScore = progress?.score ?? 0
      const lastActivity = progress?.lastActivityAt ?? new Date(0)
      const effective = applyDecay(rawScore, lastActivity)

      if (effective >= 90) continue

      // Emit theory block if not already in history
      if (!theoryConceptsInHistory.has(cl.conceptId)) {
        const blocks = cl.concept.theoryBlocks.map(tb => tb.content)
        const order = await nextOrder(session.id)
        await prisma.chatMessage.create({
          data: {
            sessionId: session.id, role: 'SYSTEM', type: 'THEORY_BLOCK',
            payload: { conceptId: cl.conceptId, blocks },
            order,
          },
        })
        sseEmit(res, { type: 'system:theory_block', payload: { conceptId: cl.conceptId, blocks } })
      }

      // Find next unused exercise for this concept
      const nextEx = cl.concept.exerciseLinks
        .map(el => el.exercise)
        .filter(ex => !usedExerciseIds.has(ex.id))
        .sort((a, b) => a.order - b.order)[0]

      if (nextEx) {
        const order = await nextOrder(session.id)
        await prisma.chatMessage.create({
          data: {
            sessionId: session.id, role: 'SYSTEM', type: 'EXERCISE_CARD',
            payload: { exerciseId: nextEx.id, submitted: false },
            order,
          },
        })
        sseEmit(res, {
          type: 'system:exercise_card',
          payload: { exerciseId: nextEx.id, exercise: toStudentExercise(nextEx) },
        })
        break
      }
    }

    sseEmit(res, { type: 'done' })
    res.end()
  } catch (err) {
    console.error('[POST /advance]', err)
    if (!res.headersSent) res.status(500).json({ error: 'Failed to advance session' })
    else res.end()
  }
})
```

- [ ] Commit: `git add apps/api/src/routes/session.ts && git commit -m "feat: add POST /session/advance endpoint"`

---

## Task 6: POST /session/exercises/:id/submit — Phase 2 Scoring

**Files:**
- Modify: `apps/api/src/routes/session.ts`

This endpoint grades an answer, updates the score in the DB, determines upcoming system events, and streams them back via SSE. The scoring and DB update logic is the **core business logic** of the platform.

- [ ] Add the Anthropic client (reference the pattern in `apps/api/src/services/courseGeneration.ts`)

```ts
import Anthropic from '@anthropic-ai/sdk'
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
```

- [ ] Add the `clamp` helper

```ts
const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val))
```

- [ ] Add `TODO(human)` scaffold for the Phase 2 scoring helper

```ts
// TODO(human): Implement applyPhase2Score
//
// This is the function that actually updates the student's concept score after
// an exercise submission. It is the core write operation of the scoring system.
//
// What it needs to do:
//   1. Load the current StudentConceptProgress row for this user + concept
//      (use findFirst; it may not exist yet if this is their first exercise)
//   2. Compute newScore = clamp(currentScore + scoreChange, 0, 100)
//      where currentScore = existing row's score, or 0 if no row exists
//   3. Upsert the StudentConceptProgress row:
//      - If it exists: update { score: newScore }
//      - If it doesn't: create { userId, conceptId, score: newScore }
//      Prisma upsert syntax: prisma.studentConceptProgress.upsert({
//        where: { userId_conceptId: { userId, conceptId } },
//        update: { score: newScore },
//        create: { userId, conceptId, score: newScore },
//      })
//   4. Compute effectiveScore = applyDecay(newScore, new Date())
//      (lastActivityAt just got set to now, so decay ≈ 0 — but use this
//       consistent call anyway so it flows through the same formula)
//   5. Return { newScore, effectiveScore }
//
// IMPORTANT: Do NOT set lastActivityAt manually.
// Prisma's @updatedAt directive sets it automatically when you update the row.
// Just update the score field and lastActivityAt will be auto-set to now().
//
// Parameters:
//   userId: string
//   conceptId: number
//   scoreChange: number  (positive or negative)
//   prisma: PrismaClient
//
// Return type: Promise<{ newScore: number; effectiveScore: number }>
//
// Hint: the clamp helper is already defined above.

async function applyPhase2Score(
  userId: string,
  conceptId: number,
  scoreChange: number,
  prismaClient: PrismaClient,
): Promise<{ newScore: number; effectiveScore: number }> {
  // Your implementation here
  throw new Error('Not implemented')
}
```

- [ ] Implement the FT grading call helper

```ts
async function gradeFreeText(
  question: string,
  sampleAnswer: string,
  rubric: string,
  studentAnswer: string,
): Promise<{ scoreChange: number; correct: boolean } | null> {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      system: 'You are a grader. Return ONLY valid JSON: {"scoreChange": <int -100 to 100>, "correct": <bool>}. No explanation.',
      messages: [{
        role: 'user',
        content: `Question: ${question}\nSample answer: ${sampleAnswer}\nRubric: ${rubric}\nStudent answer: ${studentAnswer}`,
      }],
    })

    const text = (msg.content[0] as any).text
    const parsed = JSON.parse(text)
    const sc = parseInt(parsed.scoreChange)
    if (isNaN(sc) || sc < -100 || sc > 100) return null
    return { scoreChange: sc, correct: !!parsed.correct }
  } catch {
    return null
  }
}
```

- [ ] Implement `POST /exercises/:exerciseId/submit`

```ts
router.post('/exercises/:exerciseId/submit', requireAuth, async (req: Request, res: Response) => {
  const moduleId   = parseInt(req.params.moduleId)
  const exerciseId = parseInt(req.params.exerciseId)
  const { answer } = req.body as { answer: string | number }

  if (isNaN(moduleId) || isNaN(exerciseId)) {
    res.status(400).json({ error: 'Invalid IDs' }); return
  }

  try {
    const [session, exercise] = await Promise.all([
      prisma.moduleSession.findUnique({
        where: { userId_moduleId: { userId: req.user!.id, moduleId } },
      }),
      prisma.exercise.findUnique({
        where: { id: exerciseId },
        include: { conceptLinks: true, courseModule: true },
      }),
    ])

    if (!session || !exercise) {
      res.status(404).json({ error: 'Session or exercise not found' }); return
    }

    // Verify the exercise belongs to this module (prevents cross-module score manipulation)
    if (exercise.courseModuleId !== moduleId) {
      res.status(400).json({ error: 'Exercise does not belong to this module' }); return
    }

    // ── Step 1: Grade ──
    let scoreChange: number
    let correct: boolean
    let feedback: string

    if (exercise.type === 'MULTIPLE_CHOICE') {
      const selectedIndex = typeof answer === 'number' ? answer : parseInt(String(answer))
      correct = selectedIndex === exercise.correctIndex
      scoreChange = correct ? 20 : -10
      feedback = exercise.explanation ?? ''
    } else {
      // FREE_TEXT
      const grading = await gradeFreeText(
        exercise.question,
        exercise.sampleAnswer ?? '',
        exercise.rubric ?? '',
        String(answer),
      )
      if (!grading) {
        sseOpen(res)
        sseEmit(res, { type: 'system:message', payload: { content: 'Grading failed. Please try again.' } })
        sseEmit(res, { type: 'done' })
        res.end()
        return
      }
      scoreChange = grading.scoreChange
      correct = grading.correct
      feedback = 'Answer submitted.'
    }

    // ── Steps 2–4: Update scores for all concepts this exercise tests ──
    const conceptIds = exercise.conceptLinks.map(cl => cl.conceptId)
    const scoreResults = await Promise.all(
      conceptIds.map(conceptId =>
        applyPhase2Score(req.user!.id, conceptId, scoreChange, prisma)
      )
    )

    // Use the first concept's effective score for mastery checks (primary concept)
    const primaryEffective = scoreResults[0]?.effectiveScore ?? 0

    // ── Step 5: Determine upcoming system events ──
    const conceptLinks = await prisma.moduleConcept.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
      include: {
        concept: {
          include: {
            theoryBlocks: { orderBy: { order: 'asc' } },
            exerciseLinks: {
              include: { exercise: { include: { conceptLinks: true } } }
            },
            progressEntries: { where: { userId: req.user!.id } },
          }
        }
      }
    })

    const history = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { order: 'asc' },
    })

    const usedExerciseIds = new Set(
      history
        .filter(m => m.type === 'EXERCISE_CARD' || m.type === 'PRIOR_KNOWLEDGE_QUESTION')
        .map(m => (m.payload as any).exerciseId as number)
    )
    const theoryConceptsInHistory = new Set(
      history.filter(m => m.type === 'THEORY_BLOCK').map(m => (m.payload as any).conceptId as number)
    )

    // Compute effective scores for all concepts (for MODULE_END_REACHED)
    const allConceptEffective = conceptLinks.map(cl => {
      const p = cl.concept.progressEntries[0]
      return {
        conceptId: cl.conceptId,
        effectiveScore: p ? applyDecay(p.score, p.lastActivityAt) : 0,
      }
    })

    const masteredNow = primaryEffective >= 90
    const allMastered = allConceptEffective.every(c => c.effectiveScore >= 90)

    // Collect system events to persist and emit
    type PendingEvent = { type: string; payload: any; msgType: string }
    const pendingEvents: PendingEvent[] = []

    if (masteredNow) {
      pendingEvents.push({
        type: 'system:concept_mastery_reached',
        msgType: 'CONCEPT_MASTERY_REACHED',
        payload: { conceptId: conceptIds[0], newEffectiveScore: primaryEffective },
      })
    }

    if (allMastered) {
      const nextModule = await prisma.courseModule.findFirst({
        where: {
          courseId: exercise.courseModule?.courseId ?? 0,
          order: { gt: (await prisma.courseModule.findUnique({ where: { id: moduleId }, select: { order: true } }))?.order ?? 0 },
        },
        orderBy: { order: 'asc' },
        select: { id: true },
      })
      pendingEvents.push({
        type: 'system:module_end_reached',
        msgType: 'MODULE_END_REACHED',
        payload: { conceptScores: allConceptEffective, nextModuleId: nextModule?.id },
      })
    } else if (!masteredNow) {
      // Find next exercise in concept loop
      for (const cl of conceptLinks) {
        const p = cl.concept.progressEntries[0]
        const eff = p ? applyDecay(p.score, p.lastActivityAt) : 0
        if (eff >= 90) continue

        if (!theoryConceptsInHistory.has(cl.conceptId)) {
          const blocks = cl.concept.theoryBlocks.map(tb => tb.content)
          pendingEvents.push({
            type: 'system:theory_block',
            msgType: 'THEORY_BLOCK',
            payload: { conceptId: cl.conceptId, blocks },
          })
        }

        const nextEx = cl.concept.exerciseLinks
          .map(el => el.exercise)
          .filter(ex => !usedExerciseIds.has(ex.id) && ex.id !== exerciseId)
          .sort((a, b) => a.order - b.order)[0]

        if (nextEx) {
          pendingEvents.push({
            type: 'system:exercise_card',
            msgType: 'EXERCISE_CARD',
            payload: { exerciseId: nextEx.id, submitted: false },
          })
        }
        break
      }
    }

    // ── Step 6: Persist system events ──
    for (const ev of pendingEvents) {
      const order = await nextOrder(session.id)
      await prisma.chatMessage.create({
        data: {
          sessionId: session.id, role: 'SYSTEM',
          type: ev.msgType as any,
          payload: ev.payload,
          order,
        },
      })
    }

    // ── Step 7: Mutate submitted exercise card ──
    // Find the specific unsubmitted card for this exercise and update it.
    // updateMany can't do partial JSON field updates, so we find the record first.
    const exerciseMsg = history.find(
      m => (m.type === 'EXERCISE_CARD' || m.type === 'PRIOR_KNOWLEDGE_QUESTION')
        && (m.payload as any).exerciseId === exerciseId
        && (m.payload as any).submitted === false
    )
    if (exerciseMsg) {
      await prisma.chatMessage.update({
        where: { id: exerciseMsg.id },
        data: { payload: { exerciseId, submitted: true, result: { correct, scoreChange, feedback } } },
      })
    }

    // ── Step 8: Stream feedback ──
    sseOpen(res)
    sseEmit(res, {
      type: 'system:exercise_submitted',
      payload: { exerciseId, result: { correct, scoreChange, feedback } },
    })

    // AI feedback stream
    const module = await prisma.courseModule.findUnique({
      where: { id: moduleId },
      select: { name: true, whyThisModule: true, buildsOn: true, leadsInto: true },
    })
    const theoryForContext = conceptLinks
      .filter(cl => conceptIds.includes(cl.conceptId))
      .flatMap(cl => cl.concept.theoryBlocks.map(tb => tb.content))
      .join('\n\n')

    const recentChat = history
      .filter(m => m.role !== 'SYSTEM' && m.type === 'TEXT')
      .slice(-20)
      .map(m => ({
        role: m.role === 'AI' ? 'assistant' : 'user' as const,
        content: (m.payload as any).content as string,
      }))

    let aiContent = ''

    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      stream: true,
      system: `You are a Socratic tutor. Never give direct answers. Always cite the theory provided.
Module: ${module?.name}. ${module?.whyThisModule ?? ''}
Theory:
${theoryForContext}
The student just answered an exercise. correct=${correct}, scoreChange=${scoreChange}.`,
      messages: [
        ...recentChat,
        {
          role: 'user',
          content: `My answer was: ${String(answer)}`,
        },
      ],
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        aiContent += chunk.delta.text
        sseEmit(res, { type: 'token', content: chunk.delta.text })
      }
    }

    // Emit persisted system events
    for (const ev of pendingEvents) {
      sseEmit(res, { type: ev.type as any, payload: ev.payload } as any)
    }

    sseEmit(res, { type: 'done' })
    res.end()

    // ── Step 9: Persist AI TEXT (after stream) ──
    const aiOrder = await nextOrder(session.id)
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id, role: 'AI', type: 'TEXT',
        payload: { content: aiContent },
        order: aiOrder,
      },
    })
  } catch (err) {
    console.error('[POST /exercises/:id/submit]', err)
    if (!res.headersSent) res.status(500).json({ error: 'Failed to submit exercise' })
    else res.end()
  }
})
```

- [ ] Commit: `git add apps/api/src/routes/session.ts && git commit -m "feat: add POST /session/exercises/:id/submit"`

---

## Task 7: POST /session/messages — Free Chat

**Files:**
- Modify: `apps/api/src/routes/session.ts`

- [ ] Implement `POST /messages`

```ts
router.post('/messages', requireAuth, async (req: Request, res: Response) => {
  const moduleId = parseInt(req.params.moduleId)
  const { content } = req.body as { content: string }
  if (!content?.trim()) { res.status(400).json({ error: 'content required' }); return }

  try {
    const session = await prisma.moduleSession.findUnique({
      where: { userId_moduleId: { userId: req.user!.id, moduleId } },
    })
    if (!session) { res.status(404).json({ error: 'Session not found' }); return }

    // Persist student message
    const studentOrder = await nextOrder(session.id)
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id, role: 'STUDENT', type: 'TEXT',
        payload: { content }, order: studentOrder,
      },
    })

    const history = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { order: 'asc' },
    })

    const recentChat = history
      .filter(m => m.role !== 'SYSTEM' && m.type === 'TEXT')
      .slice(-20)
      .map(m => ({
        role: m.role === 'AI' ? 'assistant' : 'user' as const,
        content: (m.payload as any).content as string,
      }))

    const module = await prisma.courseModule.findUnique({
      where: { id: moduleId },
      select: { name: true, whyThisModule: true, buildsOn: true, leadsInto: true },
    })

    sseOpen(res)

    let aiContent = ''
    const stream = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      stream: true,
      system: `You are a Socratic tutor for the module "${module?.name}". Never give direct answers. Always guide with questions.`,
      messages: recentChat,
    })

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        aiContent += chunk.delta.text
        sseEmit(res, { type: 'token', content: chunk.delta.text })
      }
    }

    sseEmit(res, { type: 'done' })
    res.end()

    const aiOrder = await nextOrder(session.id)
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id, role: 'AI', type: 'TEXT',
        payload: { content: aiContent }, order: aiOrder,
      },
    })
  } catch (err) {
    console.error('[POST /messages]', err)
    if (!res.headersSent) res.status(500).json({ error: 'Failed to send message' })
    else res.end()
  }
})
```

- [ ] Commit: `git add apps/api/src/routes/session.ts && git commit -m "feat: add POST /session/messages free chat endpoint"`

---

## Task 8: Register Session Route

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] Import and mount the session router with `mergeParams`

```ts
import sessionRouter from './routes/session'

// After existing app.use lines:
app.use('/api/student/courses/:courseId/modules/:moduleId', sessionRouter)
```

Note: The `{ mergeParams: true }` is set inside `session.ts` (already done in Task 5). This line makes parent path params (`:courseId`, `:moduleId`) available inside the router.

- [ ] Restart dev server and verify `GET /api/student/courses/1/modules/1/session` returns JSON (or 403 if not enrolled)

- [ ] Commit: `git add apps/api/src/index.ts && git commit -m "feat: register session router"`

---

## Task 9: Refactor Exercise Components

**Files:**
- Modify: `apps/web/.../session/ExerciseCard.tsx`
- Modify: `apps/web/.../session/MultipleChoiceExercise.tsx`
- Modify: `apps/web/.../session/FreeTextExercise.tsx`

Currently the exercise components manage their own local `submitted` state and don't call any backend. They need to be lifted up: submission is now triggered by a callback, and result display is driven by a prop from the parent.

- [ ] Update `ExerciseCard.tsx` interface

```tsx
import { StudentExercise, ExerciseResult } from '@metis/types'

interface Props {
  exercise: StudentExercise
  result?: ExerciseResult          // undefined = not yet submitted
  onSubmit: (exerciseId: number, answer: string | number) => void
  disabled?: boolean               // true while SSE stream is in progress
}

export default function ExerciseCard({ exercise, result, onSubmit, disabled }: Props) {
  if (exercise.type === 'MULTIPLE_CHOICE')
    return <MultipleChoiceExercise exercise={exercise} result={result} onSubmit={onSubmit} disabled={disabled} />
  if (exercise.type === 'FREE_TEXT')
    return <FreeTextExercise exercise={exercise} result={result} onSubmit={onSubmit} disabled={disabled} />
  return null
}
```

- [ ] Update `MultipleChoiceExercise.tsx`

Replace local `submitted` / `isCorrect` state with props:
```tsx
interface Props {
  exercise: StudentExercise
  result?: ExerciseResult
  onSubmit: (exerciseId: number, answer: number) => void
  disabled?: boolean
}

// Replace: const submitted = selectedIndex !== null
// With:
const submitted = !!result

// Replace: const isCorrect = selectedIndex === exercise.correctIndex
// With:
const isCorrect = result?.correct ?? false

// On button click: onSubmit(exercise.id, index)
// In feedback section: result.feedback instead of exercise.explanation
```

- [ ] Update `FreeTextExercise.tsx` similarly

```tsx
// submitted = !!result
// On submit: onSubmit(exercise.id, answer)
// Remove local setSubmitted — driven by result prop
```

- [ ] Commit: `git add apps/web/src/app/student && git commit -m "refactor: lift exercise submission state to parent"`

---

## Task 10: Wire Up SessionShell

**Files:**
- Modify: `apps/web/.../session/SessionShell.tsx`

This is the main client component. It owns all session state and coordinates the SSE streams.

- [ ] Replace the local `ChatMessage` type with imports from `@metis/types`

```tsx
import { ChatMessage, StudentExercise, GetSessionResponse, SseEvent } from '@metis/types'
```

- [ ] Update state

```tsx
const [messages, setMessages] = useState<ChatMessage[]>([])
const [exercises, setExercises] = useState<Record<string, StudentExercise>>({})
const [streaming, setStreaming] = useState(false)
const [activeExercise, setActiveExercise] = useState<number | null>(null)
const [streamingAiId] = useState(() => crypto.randomUUID())
```

- [ ] Add the SSE stream consumer utility

```tsx
// Reads a fetch response body as an SSE stream.
// Calls onEvent for each parsed event, calls onDone when "done" arrives.
async function consumeSse(
  response: Response,
  onEvent: (event: SseEvent) => void,
) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.replace(/^data: /, '').trim()
      if (!line) continue
      try {
        const event = JSON.parse(line) as SseEvent
        onEvent(event)
        if (event.type === 'done') return
      } catch (e) {
        if (process.env.NODE_ENV === 'development') console.error('Failed to parse SSE event:', line, e)
      }
    }
  }
}
```

- [ ] Add the `TODO(human)` SSE event handler

```tsx
// TODO(human): Implement handleSseEvent
//
// This function is the bridge between the SSE stream and the UI state.
// Every event the server sends flows through here.
//
// It receives one SseEvent at a time. Your job: update React state to match.
//
// Event types and what to do with each:
//
//   "token"
//     → Append the token to the currently-streaming AI message.
//       The streaming AI message is identified by `streamingAiId`.
//       If no streaming AI message exists yet in `messages`, create one
//       with role=AI, type=TEXT, and id=streamingAiId.
//       Hint: use setMessages(prev => ...) with immutable update
//
//   "system:message"
//     → Append a new SYSTEM_MESSAGE ChatMessage to messages
//
//   "system:theory_block"
//     → Append a new THEORY_BLOCK ChatMessage to messages
//
//   "system:exercise_card" / "system:prior_knowledge_question"
//     → Add the exercise to the `exercises` map (keyed by exerciseId as string)
//     → Append the exercise card ChatMessage to messages
//     → Set activeExercise to the exerciseId
//
//   "system:exercise_submitted"
//     → Find the message in `messages` where payload.exerciseId matches
//     → Mutate that message's payload: set submitted=true, result=event.payload.result
//     → Clear activeExercise (set to null)
//     Hint: spread the message and override only the payload fields you're mutating:
//       setMessages(prev => prev.map(m =>
//         m.id === target
//           ? { ...m, payload: { ...(m.payload as any), submitted: true, result: event.payload.result } }
//           : m
//       ))
//
//   "system:concept_mastery_reached"
//     → Append a CONCEPT_MASTERY_REACHED ChatMessage
//
//   "system:module_end_reached"
//     → Append a MODULE_END_REACHED ChatMessage
//
//   "done"
//     → Set streaming = false
//
// Parameters:
//   event: SseEvent
//   streamingAiId: string  (stable ID for the in-progress AI bubble)
//
// The function should call the React state setters: setMessages, setExercises,
// setActiveExercise, setStreaming. These are in scope via the component closure.

function handleSseEvent(event: SseEvent) {
  // Your implementation here
}
```

- [ ] Add the page load `useEffect`

```tsx
useEffect(() => {
  async function load() {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/student/courses/${courseId}/modules/${currentModule.id}/session`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    )
    if (!res.ok) return

    const data: GetSessionResponse = await res.json()
    setMessages(data.messages)
    setExercises(data.exercises)

    // Scan for last unsubmitted card
    const unsubmitted = [...data.messages]
      .reverse()
      .find(m =>
        (m.type === 'EXERCISE_CARD' || m.type === 'PRIOR_KNOWLEDGE_QUESTION')
        && !m.payload.submitted
      )

    if (unsubmitted) {
      setActiveExercise((unsubmitted.payload as any).exerciseId)
    } else {
      callAdvance()
    }
  }
  load()
}, [])
```

Note: you'll need to pass `accessToken` down from the server component (`page.tsx` already has the supabase session — add it to `SessionShell` props and pass it).

- [ ] Add `callAdvance`

```tsx
async function callAdvance() {
  setStreaming(true)
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/student/courses/${courseId}/modules/${currentModule.id}/session/advance`,
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } }
  )
  await consumeSse(res, handleSseEvent)
  setStreaming(false)
}
```

- [ ] Add `handleSend` for free chat

```tsx
async function handleSend() {
  if (!input.trim() || streaming) return
  const content = input.trim()
  setInput('')
  setStreaming(true)

  // Optimistically add student message to stream
  setMessages(prev => [...prev, {
    id: crypto.randomUUID(), sessionId: '', role: 'STUDENT', type: 'TEXT',
    payload: { content }, order: 0, createdAt: new Date().toISOString(),
  }])

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/student/courses/${courseId}/modules/${currentModule.id}/session/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }
  )
  await consumeSse(res, handleSseEvent)
  setStreaming(false)
}
```

- [ ] Add `handleExerciseSubmit`

```tsx
async function handleExerciseSubmit(exerciseId: number, answer: string | number) {
  setStreaming(true)
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/student/courses/${courseId}/modules/${currentModule.id}/session/exercises/${exerciseId}/submit`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer }),
    }
  )
  await consumeSse(res, handleSseEvent)
  // After submit stream ends: if no active exercise, call advance
  if (activeExercise === null) callAdvance()
}
```

- [ ] Update message rendering to use the new types and pass `onSubmit`/`result` to `ExerciseCard`

- [ ] Add markdown rendering for AI TEXT messages (install `react-markdown` if not present: `pnpm --filter web add react-markdown`)

- [ ] Add auto-scroll effect on messages change

```tsx
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
}, [messages])
```

- [ ] Commit: `git add apps/web && git commit -m "feat: wire up SessionShell with SSE and page load"`

---

## Testing Checklist

Run the app (`pnpm dev`) and verify these flows manually:

- [ ] Fresh visit: Phase 1 PKQ appears one at a time
- [ ] Correct PKQ answer: `score` in DB set to 50 (or unchanged if ≥50); next PKQ emitted after `done`
- [ ] After all 3 PKQs submitted: Phase 2 begins, theory block + exercise card appear
- [ ] MC exercise correct: score +20, card shows green; MC wrong: score -10, card shows red
- [ ] FT exercise: grading call fires, AI feedback streams in
- [ ] Free chat works while no activeExercise
- [ ] Returning visit: last unsubmitted card is found and set as active
- [ ] `effectiveScore ≥ 90`: CONCEPT_MASTERY_REACHED card appears in stream
- [ ] All concepts mastered: MODULE_END_REACHED card appears with next module button

---
