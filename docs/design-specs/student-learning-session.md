# Student Learning Session (`/student/courses/:id/module/:id/session`)

This is the core student screen. Students spend the majority of their time here.

---

## Layout zones

Three horizontal zones. The sidebar and materials panel are hidden by default and appear on cursor hover at the screen edges.

```
[ Left sidebar ]  [ Chat stream ]  [ Materials panel ]
  hover to show     always visible    hover to show
```

**Left sidebar** — appears when cursor moves to the far left edge. Contains: app logo/home link, course name and progress, module list with completion state, link to student dashboard, account/settings.

**Chat stream** — always visible. Expands to fill available space when both panels are hidden. Scrollable, anchored to bottom (newest at bottom). Smooth scroll when new content arrives.

**Materials panel** — appears when cursor moves to the far right edge. Contains two tabs:
- **Theory:** base theory for the module organized by concept. Read-only, scrollable.
- **Resources:** teacher-uploaded files tied to this module. Each shows title and type (PDF, link, etc.). Clicking opens inline within the panel — no navigation away from the session.

---

## Score model

`StudentConceptProgress` tracks two fields:
- `score` (Float, 0–100) — the raw score. Only updated after exercise submissions. Never written back on read.
- `lastActivityAt` (DateTime, Prisma `@updatedAt`) — auto-set on every row update. Used to compute decay. Must not be set manually.

**Effective score** is computed on-the-fly: `effectiveScore = applyDecay(score, lastActivityAt)`. All ≥90 threshold checks throughout the session use `effectiveScore`, not `score`. The decay formula is defined separately (out of scope for this spec).

The GET response and all phase logic compute `effectiveScore` at query time. Only `score` and `lastActivityAt` are stored.

**During an active session**, `score` and `lastActivityAt` are written to the DB after every exercise submission. Because negligible time elapses between consecutive exercises within the same session, `effectiveScore ≈ score` for all in-session checks. Decay is only meaningfully non-zero at the start of a new session, after time has passed since the student last interacted.

---

## Message types in the stream

All of the following appear inline within the chat stream:

| Type | Description |
|---|---|
| AI tutor message | Streaming text bubble. Socratic — never gives direct answers. May reference theory with a cited source. |
| Student message | Visually distinct (right-aligned). Plain text. |
| Theory block | A distinct read-only card presenting a concept's theory. Markdown rendered. |
| Exercise card | An interactive card with a question and answer input. Student submits answer directly in the card. After submission the card updates in place to show feedback (correct/incorrect + brief explanation). |
| Prior knowledge question | Same visual as exercise card. Appears one at a time at module start for baseline assessment. |
| Concept mastery reached | Small inline card shown when a concept's effective score crosses ≥90. Not a permanent state — effective score decays over time. |
| Module end reached | Shown when all concepts in the module have effective score ≥90. Summary of effective scores + prompt to move to next module. |
| System message | Subtle, centered text. Used for transitions. |

---

## Session flow

### Phase 1 — Baseline assessment

Phase 1 is entered when `POST .../session/advance` is called and no `PRIOR_KNOWLEDGE_QUESTION` records exist in chat history.

1. Pool = all exercises where `Exercise.courseModuleId = :moduleId`, regardless of per-concept scores. Server selects `min(3, poolSize)` exercises at random.
2. The first `PRIOR_KNOWLEDGE_QUESTION` is persisted to `ChatMessage` and emitted via SSE as `system:prior_knowledge_question`.
3. The server does not emit the next question until it receives and processes the answer to the current one.
4. After each answer the server grades it and updates `StudentConceptProgress` for each concept the exercise tests (M:M via `ExerciseConcept`):
   - Correct → if `score < 50`, set `score = 50` (Prisma upsert). If `score >= 50`, no change. Phase 1 never raises raw `score` above 50.
   - Wrong → no update.
5. Server emits `system:exercise_submitted` with `result: { correct: boolean, scoreChange: 0, feedback: "" }` (Phase 1 does not adjust scores; `correct` reflects whether the answer was right; `feedback` is empty — the AI TEXT bubble provides any narrative) and `done`. Client clears `activeExercise` and calls `advance` again.
6. **Phase 1 completion:** Phase 1 is complete when all `PRIOR_KNOWLEDGE_QUESTION` records in history have `payload.submitted === true`. The server never injects more PKQ records than originally selected, so this check is stable across teacher edits between visits.

Phase 1 does not use `scoreChange` — it is the sole exception to the additive scoring model used in Phase 2.

**Identifying Phase 1 exercises:** Scan `ChatMessage` history for `type = PRIOR_KNOWLEDGE_QUESTION`, read `payload.exerciseId`.

**Phase 1 resumption:** `advance` counts submitted PKQs in history and emits question N+1.

**Exhausted exercises in Phase 2:** If all exercises for a concept were used as PKQs in Phase 1, the Phase 2 loop carries forward the current score and moves to the next concept. Expected behavior, not an error.

### Phase 2 — Concept loop

Phase 2 is entered when Phase 1 is complete.

**Server-side order of operations for each exercise submission:**
1. Evaluate (MC: deterministic; FT: LLM grading call)
2. Compute `scoreChange`
3. Update `StudentConceptProgress`: `score = clamp(currentScore + scoreChange, 0, 100)`. Upsert with `currentScore = 0` if no row exists. (`lastActivityAt` updates automatically)
4. Compute `effectiveScore = applyDecay(newScore, now())` for this concept. This value is used for all ≥90 checks at this step and becomes `newEffectiveScore` in any `CONCEPT_MASTERY_REACHED` event — it is not recomputed later.
5. Determine upcoming system events. Compute `effectiveScore` for all module concepts now to populate `MODULE_END_REACHED.conceptScores`.
6. Persist all upcoming system events to `ChatMessage` (with sequential `order` values)
7. Mutate submitted exercise `ChatMessage` payload: `submitted = true`, `result = { correct, scoreChange, feedback }`
8. Begin SSE stream: `system:exercise_submitted` → AI TEXT tokens → persisted system events → `done`
9. After stream ends: persist AI TEXT to `ChatMessage`

> **Known gap:** If connection drops between steps 8 and 9, the AI TEXT response is never persisted. On reload the student sees a submitted card with no AI feedback for that exchange. Session state (score, next card) is unaffected. To be addressed in a future iteration.

**`result.feedback`:**
- MC: `Exercise.explanation` (static explanation from generation)
- FT: brief status (e.g. "Answer submitted"). Narrative feedback is the AI TEXT bubble in the stream.

**On returning visits:** Cards with `submitted: true` render `payload.result` directly. `system:exercise_submitted` is only emitted during live streams.

**Concept loop:**

*"Persist and emit" below means: write a `ChatMessage` record to DB, then send the corresponding SSE event.*

```
For each concept (ModuleConcept.order ASC):

  effectiveScore ≥ 90? → skip

  THEORY_BLOCK already in history for this concept? → skip
  else → persist and emit THEORY_BLOCK (TheoryBlock rows ORDER BY order ASC, map to content strings)

  next exercise = exercises for concept N via ExerciseConcept, ORDER BY Exercise.order ASC
                  skip exerciseIds already in history as PRIOR_KNOWLEDGE_QUESTION or EXERCISE_CARD

  exercises remain?
    yes → persist and emit EXERCISE_CARD → student submits → evaluate → follow order of operations above
          effectiveScore ≥ 90? → CONCEPT_MASTERY_REACHED → next concept
          else                 → next unsubmitted exercise
    no  → carry forward current effectiveScore, next concept

all concepts done → MODULE_END_REACHED
```

**MC scoring:** correct: +20, wrong: -10.
**FT grading:** LLM returns `{ scoreChange: int ∈ [-100, 100] inclusive, correct: bool }`. Grading prompt instructs LLM to target this range. On failure or out-of-range: do not update score, do not mutate payload, surface `system:message` error, card stays `submitted: false`.

**nextModuleId:** `CourseModule` records for same course `ORDER BY order ASC`. Record immediately after current module; field omitted if none.

**AI context — current concept:** for exercises that test multiple concepts (M:M), include theory blocks for all tested concepts ordered by `ModuleConcept.order ASC`, concatenated. This gives the AI the full relevant context regardless of how many concepts the exercise spans.

### Phase 3 — Free chat

Student types → `POST .../messages` → SSE of AI TEXT tokens. Input bar disabled while streaming.

### Phase 4 — Returning visit

All upcoming system events are persisted before the SSE stream begins, so a returning student always finds the next `EXERCISE_CARD` in history as `submitted: false`. Client sets `activeExercise` and continues.

If `activeExercise === null`, client calls `POST .../session/advance`:
- No PKQ records → Phase 1
- PKQ records, Phase 1 incomplete → Phase 1 resumption (emit next question)
- Phase 1 complete, no active card → Phase 2: emit `system:message` ("Resuming where you left off"), then persist and emit the theory block (if not already in history) and next exercise card for the first concept with `effectiveScore < 90`. Exercise selection and theory block emission follow the same deduplication rules as the concept loop: skip exerciseIds already in history as `PRIOR_KNOWLEDGE_QUESTION` or `EXERCISE_CARD`; only persist and emit theory block if not already in history.

---

## Data model

### New tables

**`ModuleSession`**

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `userId` | FK → StudentProfile | matches convention used by StudentConceptProgress and Enrollment |
| `moduleId` | FK → CourseModule | |
| `createdAt` | DateTime | |
| *(unique)* | `(userId, moduleId)` | one session per student per module |

Server uses **upsert** (create-or-return).

**`ChatMessage`**

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | |
| `sessionId` | FK → ModuleSession | |
| `role` | enum `AI \| STUDENT \| SYSTEM` | |
| `type` | enum `TEXT \| THEORY_BLOCK \| EXERCISE_CARD \| PRIOR_KNOWLEDGE_QUESTION \| SYSTEM_MESSAGE \| CONCEPT_MASTERY_REACHED \| MODULE_END_REACHED` | drives frontend rendering |
| `payload` | JSON | mutable for EXERCISE_CARD and PRIOR_KNOWLEDGE_QUESTION |
| `order` | Int | session-scoped sequence integer, assigned by server at insert; messages loaded `ORDER BY order ASC` |
| `createdAt` | DateTime | |

Using an explicit `order` field (rather than `createdAt`) ensures deterministic ordering when multiple events are persisted in the same operation.

| Type | Role | Payload |
|---|---|---|
| `TEXT` | AI or STUDENT | `{ content: string }` |
| `SYSTEM_MESSAGE` | SYSTEM | `{ content: string }` — centered transition text (e.g. "Resuming where you left off") |
| `THEORY_BLOCK` | SYSTEM | `{ conceptId: string, blocks: string[] }` — ordered markdown strings |
| `EXERCISE_CARD` | SYSTEM | `{ exerciseId: string, submitted: boolean, result?: { correct: boolean, scoreChange: number, feedback: string } }` |
| `PRIOR_KNOWLEDGE_QUESTION` | SYSTEM | same as EXERCISE_CARD; `result.scoreChange` is always 0 and `result.feedback` is always `""` |
| `CONCEPT_MASTERY_REACHED` | SYSTEM | `{ conceptId: string, newEffectiveScore: number }` |
| `MODULE_END_REACHED` | SYSTEM | `{ conceptScores: { conceptId: string, effectiveScore: number }[], nextModuleId?: string }` |

### Types

```ts
// Used for Materials panel (Theory tab) only
type TheoryBlock = { id: string; content: string; order: number }

// Answer fields stripped server-side before sending to client
type StudentExercise = Omit<Exercise, 'correctIndex' | 'sampleAnswer' | 'rubric'>
```

### Existing table addition

`Exercise.source: enum TEACHER_PROVIDED | AI_PROVIDED` (default `TEACHER_PROVIDED`)

---

## API surface

| Method | Path | Description |
|---|---|---|
| `GET` | `.../session` | Upsert session, return history + module data + all exercises as `StudentExercise` |
| `POST` | `.../session/messages` | Free chat. SSE streams AI reply. |
| `POST` | `.../session/exercises/:id/submit` | Submit answer. SSE streams feedback + system events. |
| `POST` | `.../session/advance` | Called when `activeExercise === null`. Phase 1 or Phase 2 via SSE. |

### GET response

```ts
{
  session: { id: string, createdAt: string },
  messages: ChatMessage[],                       // ORDER BY order ASC
  exercises: Record<string, StudentExercise>,    // ALL module exercises; correctIndex/sampleAnswer/rubric omitted server-side
  module: {
    concepts: { id: string, name: string, order: number }[],  // ModuleConcept.order ASC
    theoryBlocks: Record<string, TheoryBlock[]>                // keyed by conceptId — Materials panel only
  }
}
```

### SSE events

```ts
{ type: "token",                           content: string }
{ type: "system:message",                  payload: { content: string } }
{ type: "system:theory_block",             payload: { conceptId: string, blocks: string[] } }
{ type: "system:exercise_card",            payload: { exerciseId: string, exercise: StudentExercise } }
{ type: "system:prior_knowledge_question", payload: { exerciseId: string, exercise: StudentExercise } }
{ type: "system:exercise_submitted",       payload: { exerciseId: string, result: { correct: boolean, scoreChange: number, feedback: string } } }
{ type: "system:concept_mastery_reached",  payload: { conceptId: string, newEffectiveScore: number } }
{ type: "system:module_end_reached",       payload: { conceptScores: { conceptId: string, effectiveScore: number }[], nextModuleId?: string } }
{ type: "done" }
```

System events persisted (with sequential `order` values) before stream. AI TEXT persisted after stream.

---

## AI context

Every LLM call assembles:

- **Role:** Socratic tutor, never reveal answers, always cite sources
- **Student profile:** omitted until student onboarding is built
- **Module context:** name, whyThisModule, buildsOn, leadsInto
- **Current concept(s):** all concepts the active exercise tests, ordered by `ModuleConcept.order ASC`. For each: name + theory blocks (`TheoryBlock.order ASC`, content only).
- **Conversation history:** last 20 `ChatMessage` records with role `AI` or `STUDENT` and type `TEXT`
- **Active exercise (if unanswered):** injected as system message — *"The student is currently working on this exercise. Do not reveal the answer or any step that leads directly to it."*

**Free chat:** full context, Socratic response.

**Exercise submission:** same context + student's answer + evaluation result. AI generates feedback. For FT this is the primary narrative feedback; for MC it supplements `Exercise.explanation` on the card.

**FT grading call (before feedback stream):**
```
input:  question, sampleAnswer, rubric, studentAnswer
output: { scoreChange: int ∈ [-100, 100] inclusive, correct: boolean }
```
On failure or out-of-range: do not update score, do not mutate payload, surface `system:message` error, card stays `submitted: false`.

---

## Frontend

```ts
messages: ChatMessage[]
exercises: Record<string, StudentExercise>
streaming: boolean
activeExercise: string | null
```

**Page load:**
1. `GET .../session` → populate state
2. Scan for last `EXERCISE_CARD` or `PRIOR_KNOWLEDGE_QUESTION` with `submitted: false` → set `activeExercise`
3. If `activeExercise === null` → call `POST .../session/advance`

**SSE stream handling:**

| Event | Action |
|---|---|
| `token` | Append to current AI bubble |
| `system:message` | Append centered system message |
| `system:exercise_card` / `system:prior_knowledge_question` | Upsert into `exercises`, append card, set `activeExercise` |
| `system:exercise_submitted` | Mutate card in-place (`submitted = true`, populate `result`), clear `activeExercise` |
| `system:theory_block` | Append theory card |
| `system:concept_mastery_reached` | Append mastery card |
| `system:module_end_reached` | Append module end card |
| `done` | `streaming = false`. If `activeExercise === null`, call `advance` (handles PKQ→next PKQ and PKQ→Phase 2 transitions). |

Input bar disabled while `streaming: true`.

**MODULE_END_REACHED:**
- `nextModuleId` present → effective score summary + button to next module landing page
- `nextModuleId` absent → effective score summary + "Course complete" + link to course overview

**Page structure:** Client Component for chat stream; sidebar and materials panel server-rendered.
