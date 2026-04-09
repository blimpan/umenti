import { Router, Request, Response } from 'express'
import prisma from '../lib/prisma'
import { Prisma } from '@prisma/client'
import { streamText, generateText, Output, type ModelMessage } from 'ai'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth'
import { applyDecay } from '../lib/decay'
import { getModel } from '../lib/llm'
import { gradeVizState } from '../lib/vizGrading'
import { GetSessionResponse, StudentExercise, SseEvent } from '@metis/types'
import { gradeMathExercise } from '../lib/mathGrading'
import type { CanonicalExpression } from '@metis/types'
import { logger, llmLogger } from '../lib/logger'

// mergeParams: true makes :courseId and :moduleId from the parent route available here
const router = Router({ mergeParams: true })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sseOpen(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // disable nginx/proxy buffering
  res.flushHeaders()
}

function sseEmit(res: Response, event: SseEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`)
  // Flush after each event so tokens reach the client immediately rather than
  // being held in the socket send buffer. The flush() method is added by
  // compression middleware; without it this is a no-op.
  ;(res as any).flush?.()
}

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val))

/** Strips answer fields before sending exercises to the client. */
function toStudentExercise(ex: {
  id: number
  type: any
  question: string
  order: number
  pendingRevision: boolean
  options: any
  explanation: string | null
  visualizationHtml: string | null
  visualizationType: string | null
  visualizationParams: unknown
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
    visualizationHtml:   ex.visualizationHtml,
    visualizationType:   ex.visualizationType,
    visualizationParams: ex.visualizationParams as Record<string, unknown> | null,
  }
}


async function applyPhase2Score(
  userId: string,
  conceptId: number,
  scoreChange: number,
): Promise<{ newScore: number; effectiveScore: number }> {
  const dbScore = await prisma.studentConceptProgress.findFirst({
    where: { userId, conceptId },
  })
  const currentScore = dbScore ? applyDecay(dbScore.score, dbScore.lastActivityAt) : 0
  const newScore = clamp(currentScore + scoreChange, 0, 100)
  const updatedDBScore = await prisma.studentConceptProgress.upsert({
    where:  { userId_conceptId: { userId, conceptId } },
    update: { score: newScore },
    create: { userId, conceptId, score: newScore },
  })

  const effectiveScore = applyDecay(updatedDBScore.score, updatedDBScore.lastActivityAt)
  return { newScore: updatedDBScore.score, effectiveScore }

}

const GradingSchema = z.object({
  correct: z.boolean(),
  almost:  z.boolean(),   // true = partially correct; only meaningful when correct === false
})

/** Grades a free-text answer with a small LLM call. Returns null on failure. */
async function gradeFreeText(
  question: string,
  sampleAnswer: string,
  rubric: string,
  studentAnswer: string,
): Promise<{ scoreChange: number; correct: boolean; almost: boolean } | null> {
  try {
    const gradeSystem = [
      'You are a grader. Evaluate the student answer against the sample answer and rubric.',
      '- correct=true if the answer is fully correct',
      '- correct=false, almost=true if partially correct or on the right track but incomplete',
      '- correct=false, almost=false if fundamentally wrong or off-topic',
    ].join('\n')
    const gradeUserMessage = `Question: ${question}\nSample answer: ${sampleAnswer}\nRubric: ${rubric}\nStudent answer: ${studentAnswer}`
    llmLogger.info({ system: gradeSystem, userMessage: gradeUserMessage }, 'grade:free-text — request')
    const { output, usage } = await generateText({
      model:  getModel(),
      output: Output.object({ schema: GradingSchema }),
      system: gradeSystem,
      messages: [{ role: 'user', content: gradeUserMessage }],
    })
    const { correct, almost } = output as { correct: boolean; almost: boolean }
    const scoreChange = correct ? 20 : almost ? 0 : -10
    llmLogger.info({ correct, almost, scoreChange, usage }, 'grade:free-text — response')
    return { correct, almost, scoreChange }
  } catch (err) {
    llmLogger.error({ err }, 'grade:free-text — failed')
    return null
  }
}

// ---------------------------------------------------------------------------
// GET /session
// ---------------------------------------------------------------------------

router.get('/', requireAuth, async (req: Request, res: Response) => {
  const moduleId = parseInt(req.params.moduleId as string)
  const courseId = parseInt(req.params.courseId as string)
  if (isNaN(moduleId) || isNaN(courseId)) {
    res.status(400).json({ error: 'Invalid module or course ID' }); return
  }

  try {
    // Check enrollment and look up existing session in parallel — neither depends on the other.
    const [enrollment, existingSession] = await Promise.all([
      prisma.enrollment.findFirst({ where: { courseId, userId: req.user!.id, status: 'ACTIVE' } }),
      prisma.moduleSession.findUnique({ where: { userId_moduleId: { userId: req.user!.id, moduleId } } }),
    ])
    if (!enrollment) { res.status(403).json({ error: 'Not enrolled' }); return }

    // Use findUnique + create instead of upsert — avoids BEGIN/COMMIT transaction overhead.
    // Still handles the P2002 race condition (two tabs opening the same session simultaneously).
    let session = existingSession ?? await prisma.moduleSession.create({
      data: { userId: req.user!.id, moduleId },
    }).catch(async (err: any) => {
      if (err?.code !== 'P2002') throw err
      const existing = await prisma.moduleSession.findUnique({
        where: { userId_moduleId: { userId: req.user!.id, moduleId } },
      })
      if (!existing) throw err
      return existing
    })

    const limit  = Math.min(parseInt(req.query.limit as string) || 7, 50)
    const before = req.query.before !== undefined
      ? parseInt(req.query.before as string)
      : undefined

    // Fetch limit+1 to detect hasMore without an extra COUNT query.
    const raw = await prisma.chatMessage.findMany({
      where: {
        sessionId: session.id,
        ...(before !== undefined ? { order: { lt: before } } : {}),
      },
      orderBy: { order: 'desc' },
      take:    limit + 1,
    })

    const hasMore  = raw.length > limit
    const messages = raw.slice(0, limit).reverse()   // back to ascending for the client

    const hasActiveExercise = messages.some(
      m => (m.type === 'EXERCISE_CARD' || m.type === 'PRIOR_KNOWLEDGE_QUESTION')
        && !(m.payload as any)?.submitted
    )

    const result: GetSessionResponse = {
      session:  { id: session.id, createdAt: session.createdAt.toISOString() },
      hasMore,
      hasActiveExercise,
      messages: messages.map(m => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role as 'AI' | 'STUDENT' | 'SYSTEM',
        type: m.type as any,
        payload: m.payload as any,
        order: m.order,
        createdAt: m.createdAt.toISOString(),
      })),
    }

    res.json(result)
  } catch (err) {
    logger.error({ err }, '[GET /session]')
    res.status(500).json({ error: 'Failed to load session' })
  }
})

// ---------------------------------------------------------------------------
// POST /session/advance
// Called when the client has no activeExercise. Detects phase and emits next event.
// ---------------------------------------------------------------------------

router.post('/advance', requireAuth, async (req: Request, res: Response) => {
  const moduleId = parseInt(req.params.moduleId as string)
  if (isNaN(moduleId)) { res.status(400).json({ error: 'Invalid module ID' }); return }

  try {
    const session = await prisma.moduleSession.findUnique({
      where: { userId_moduleId: { userId: req.user!.id, moduleId } },
    })
    if (!session) { res.status(404).json({ error: 'Session not found' }); return }

    // History and exercises don't depend on each other — fetch in parallel.
    const [history, allExercises] = await Promise.all([
      prisma.chatMessage.findMany({ where: { sessionId: session.id }, orderBy: { order: 'asc' } }),
      prisma.exercise.findMany({ where: { courseModuleId: moduleId }, include: { conceptLinks: true }, orderBy: { order: 'asc' } }),
    ])

    // Derive next order from history in-memory — avoids a separate DB call per message created
    let orderCounter = history.length > 0 ? history[history.length - 1].order + 1 : 0

    const pkqMessages = history.filter(m => m.type === 'PRIOR_KNOWLEDGE_QUESTION')
    const unsubmittedPkq = pkqMessages.find(m => !(m.payload as any).submitted)
    const pkqTarget = Math.min(3, allExercises.length)
    const usedPkqIds = new Set(pkqMessages.map(m => (m.payload as any).exerciseId as number))

    sseOpen(res)

    // ── Phase 1 resume: there is an unsubmitted PKQ in history ───────────────
    // Re-emit it (student may have refreshed mid-question).
    if (unsubmittedPkq) {
      const exerciseId = (unsubmittedPkq.payload as any).exerciseId
      const ex = allExercises.find(e => e.id === exerciseId)
      if (ex) {
        sseEmit(res, {
          type: 'system:prior_knowledge_question',
          payload: { exerciseId: ex.id, exercise: toStudentExercise(ex) },
        })
      }
      sseEmit(res, { type: 'done' })
      res.end()
      return
    }

    // ── Phase 1 in progress: all existing PKQs submitted, more needed ─────────
    // Persist and emit the next PKQ one at a time so history never contains
    // future questions the student hasn't reached yet.
    if (pkqMessages.length < pkqTarget) {
      const unused = allExercises.filter(ex => !usedPkqIds.has(ex.id))
      const next = unused.sort(() => Math.random() - 0.5)[0]
      if (next) {
        const order = orderCounter++
        await prisma.chatMessage.create({
          data: {
            sessionId: session.id, role: 'SYSTEM', type: 'PRIOR_KNOWLEDGE_QUESTION',
            payload: { exerciseId: next.id, submitted: false }, order,
          },
        })
        sseEmit(res, {
          type: 'system:prior_knowledge_question',
          payload: { exerciseId: next.id, exercise: toStudentExercise(next) },
        })
      }
      sseEmit(res, { type: 'done' })
      res.end()
      return
    }

    // pkqMessages.length >= pkqTarget && all submitted → Phase 1 complete

    // ── Phase 2 re-entry ──────────────────────────────────────────────────────
    const conceptLinks = await prisma.moduleConcept.findMany({
      where:   { moduleId },
      orderBy: { order: 'asc' },
      include: {
        concept: {
          include: {
            theoryBlocks:    { orderBy: { order: 'asc' } },
            visualizations:  { orderBy: { order: 'asc' } },
            exerciseLinks:   { include: { exercise: { include: { conceptLinks: true } } } },
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

    const EXHAUSTED_MSG = 'All available exercises for this module have been completed. Your teacher may add more soon.'
    const RESUMING_MSG  = 'Resuming where you left off.'

    const { resume } = req.body as { resume?: boolean }
    if (resume) {
      // Only emit "Resuming" if the last message in history isn't already one.
      // Also treat "exercises exhausted" as an already-resumed state — the session
      // is stuck and doesn't need another "Resuming" banner on every refresh.
      const lastMsg = history[history.length - 1]
      const lastContent = lastMsg?.type === 'SYSTEM_MESSAGE' ? (lastMsg.payload as any)?.content : null
      const alreadyResumed = lastContent === RESUMING_MSG || lastContent === EXHAUSTED_MSG
      if (!alreadyResumed) {
        const smOrder = orderCounter++
        await prisma.chatMessage.create({
          data: {
            sessionId: session.id, role: 'SYSTEM', type: 'SYSTEM_MESSAGE',
            payload: { content: RESUMING_MSG },
            order: smOrder,
          },
        })
        sseEmit(res, { type: 'system:message', payload: { content: RESUMING_MSG } })
      }
    }

    // ── Two-pass Phase 2 loop ─────────────────────────────────────────────────
    // Pass 1: emit theory for the first non-mastered concept that hasn't had it shown yet.
    // Pass 2: scan ALL non-mastered concepts for the next unused exercise — so a concept
    //         with exhausted exercises doesn't strand the session (the old single-pass
    //         loop would fall silent if concept A ran out of exercises before concept B).

    const nonMastered = conceptLinks.filter(cl => {
      const p = cl.concept.progressEntries[0]
      return (p ? applyDecay(p.score, p.lastActivityAt) : 0) < 90
    })

    // Pass 1 — theory block (at most one per advance call)
    const needsTheory = nonMastered.find(cl => !theoryConceptsInHistory.has(cl.conceptId))
    if (needsTheory) {
      const blocks = needsTheory.concept.theoryBlocks.map(tb => tb.content)
      const visualizations = needsTheory.concept.visualizations.map(v => ({
        id: v.id, order: v.order,
        visualizationType: v.visualizationType,
        visualizationParams: v.visualizationParams as Record<string, unknown>,
        visualization: v.visualization ?? null,
      }))
      const visualization = visualizations.length === 0 ? (needsTheory.concept.visualization ?? null) : null
      await prisma.chatMessage.create({
        data: {
          sessionId: session.id, role: 'SYSTEM', type: 'THEORY_BLOCK',
          payload: { conceptId: needsTheory.conceptId, blocks, visualizations, visualization } as unknown as Prisma.InputJsonValue,
          order: orderCounter++,
        },
      })
      sseEmit(res, { type: 'system:theory_block', payload: { conceptId: needsTheory.conceptId, blocks, visualizations, visualization: visualization ?? undefined } })
    }

    // Pass 2 — next exercise (scan all non-mastered concepts, not just the theory one)
    let nextExRaw: (typeof nonMastered[0]['concept']['exerciseLinks'][0]['exercise']) | undefined
    for (const cl of nonMastered) {
      nextExRaw = cl.concept.exerciseLinks
        .map(el => el.exercise)
        .filter(ex => ex.courseModuleId === moduleId && !usedExerciseIds.has(ex.id))
        .sort((a, b) => a.order - b.order)[0]
      if (nextExRaw) break
    }

    if (nextExRaw) {
      await prisma.chatMessage.create({
        data: {
          sessionId: session.id, role: 'SYSTEM', type: 'EXERCISE_CARD',
          payload: { exerciseId: nextExRaw.id, submitted: false },
          order: orderCounter++,
        },
      })
      sseEmit(res, {
        type: 'system:exercise_card',
        payload: { exerciseId: nextExRaw.id, exercise: toStudentExercise(nextExRaw) },
      })
    } else if (nonMastered.length > 0) {
      // All exercises exhausted but concepts are still unmastered — session is stuck.
      // Only emit once; the "Resuming" guard above already skips re-adding "Resuming"
      // when this message is already the last one, so this guard prevents the exhausted
      // message itself from being written again on subsequent refreshes.
      const lastMsg = history[history.length - 1]
      const alreadyExhausted = lastMsg?.type === 'SYSTEM_MESSAGE'
        && (lastMsg.payload as any)?.content === EXHAUSTED_MSG
      if (!alreadyExhausted) {
        await prisma.chatMessage.create({
          data: {
            sessionId: session.id, role: 'SYSTEM', type: 'SYSTEM_MESSAGE',
            payload: { content: EXHAUSTED_MSG },
            order: orderCounter++,
          },
        })
        sseEmit(res, { type: 'system:message', payload: { content: EXHAUSTED_MSG } })
      }
    }

    sseEmit(res, { type: 'done' })
    res.end()
  } catch (err) {
    logger.error({ err }, '[POST /advance]')
    if (!res.headersSent) res.status(500).json({ error: 'Failed to advance session' })
    else res.end()
  }
})

// ---------------------------------------------------------------------------
// POST /session/exercises/:exerciseId/submit
// ---------------------------------------------------------------------------

router.post('/exercises/:exerciseId/submit', requireAuth, async (req: Request, res: Response) => {
  const moduleId   = parseInt(req.params.moduleId as string)
  const exerciseId = parseInt(req.params.exerciseId as string)
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
        where:   { id: exerciseId },
        include: {
          conceptLinks: true,
          courseModule: { include: { course: { select: { language: true } } } },
        },
      }),
    ])

    if (!session || !exercise) {
      res.status(404).json({ error: 'Session or exercise not found' }); return
    }
    if (exercise.courseModuleId !== moduleId) {
      res.status(400).json({ error: 'Exercise does not belong to this module' }); return
    }

    // Load history early so we can detect Phase 1 vs Phase 2
    const earlyHistory = await prisma.chatMessage.findMany({
      where:   { sessionId: session.id },
      orderBy: { order: 'asc' },
    })

    const isPhase1 = earlyHistory.some(
      m => m.type === 'PRIOR_KNOWLEDGE_QUESTION' && (m.payload as any).exerciseId === exerciseId
    )

    // ── Step 1: Grade ─────────────────────────────────────────────────────────
    // Capture the full grading object so scoreChange can be reused in Phase 2
    // without a second LLM call.
    let correct: boolean
    let savedGrading: { scoreChange: number; correct: boolean; almost: boolean } | null = null

    logger.info({ exerciseId, type: exercise.type, phase: isPhase1 ? 'PRIOR_KNOWLEDGE' : 'MAIN' }, '[submit] received')

    if (exercise.type === 'MULTIPLE_CHOICE') {
      const selectedIndex = typeof answer === 'number' ? answer : parseInt(String(answer))
      correct = selectedIndex === exercise.correctIndex
    } else if (exercise.type === 'INTERACTIVE') {
      const { vizState } = req.body as { vizState?: Record<string, unknown> }
      if (!vizState || typeof vizState !== 'object' || Array.isArray(vizState)) {
        res.status(400).json({ error: 'vizState required for INTERACTIVE exercises' }); return
      }
      const target = exercise.targetState as Record<string, unknown> | null
      if (!target) {
        logger.warn({ exerciseId: exercise.id }, 'INTERACTIVE exercise has no targetState — marking incorrect')
        correct = false
      } else {
        const grade = gradeVizState(target, vizState)
        correct = grade === 'correct'
        savedGrading = {
          correct,
          almost: grade === 'almost',
          scoreChange: grade === 'correct' ? 20 : grade === 'almost' ? 0 : -10,
        }
      }
    } else {
      const raw = exercise.canonicalExpressions
      const canonical: CanonicalExpression[] | null =
        Array.isArray(raw) && raw.every((c): c is CanonicalExpression =>
          typeof (c as any)?.label === 'string' && ('sympyExpr' in (c as any))
        ) ? raw : null

      if (canonical && canonical.length > 0) {
        logger.info({ exerciseId, claims: canonical.map(c => c.label) }, '[submit] grading:math')
        const mathResult = await gradeMathExercise(
          exercise.question,
          canonical,
          exercise.rubric ?? '',
          String(answer),
        )
        if (!mathResult) {
          logger.warn({ exerciseId }, '[submit] grading:math failed — falling back to free-text')
        }
        savedGrading = mathResult ?? await gradeFreeText(
          exercise.question,
          exercise.sampleAnswer ?? '',
          exercise.rubric ?? '',
          String(answer),
        )
      } else {
        logger.info({ exerciseId }, '[submit] grading:free-text')
        savedGrading = await gradeFreeText(
          exercise.question,
          exercise.sampleAnswer ?? '',
          exercise.rubric ?? '',
          String(answer),
        )
      }

      if (!savedGrading) {
        sseOpen(res)
        sseEmit(res, { type: 'system:message', payload: { content: 'Grading failed — please try again.' } })
        sseEmit(res, { type: 'done' })
        res.end()
        return
      }
      correct = savedGrading.correct
      logger.info({ exerciseId, correct, almost: savedGrading.almost, scoreChange: savedGrading.scoreChange }, '[submit] graded')
    }

    // Compute scoreChange and feedback now so we can open SSE immediately.
    // Phase 2 FREE_TEXT reuses savedGrading.scoreChange — no second LLM call.
    const conceptIds = exercise.conceptLinks.map(cl => cl.conceptId)

    let scoreChange: number
    let feedback: string
    if (isPhase1) {
      scoreChange = 0
      feedback = ''
    } else if (exercise.type === 'MULTIPLE_CHOICE') {
      scoreChange = correct ? 20 : -10
      feedback = exercise.explanation ?? ''
    } else if (exercise.type === 'INTERACTIVE') {
      // savedGrading is set above for INTERACTIVE
      scoreChange = savedGrading?.scoreChange ?? (correct ? 20 : -10)
      feedback = correct
        ? 'Correct! Well done.'
        : savedGrading?.almost
        ? "You're close — try adjusting a bit further."
        : exercise.explanation ?? ''
    } else {
      scoreChange = savedGrading?.scoreChange ?? 0
      feedback = 'Answer submitted.'
    }

    // ── Open SSE early — student sees correct/incorrect immediately ───────────
    sseOpen(res)
    sseEmit(res, {
      type:    'system:exercise_submitted',
      payload: { exerciseId, result: { correct, almost: savedGrading?.almost ?? false, scoreChange, feedback } },
    })

    // ── Record attempt rows (one per concept) ─────────────────────────────────
    const moduleId2  = exercise.courseModuleId
    const courseId2  = exercise.courseModule.courseId

    // Normalise the raw answer to a human-readable string for LLM analysis.
    // MULTIPLE_CHOICE: resolve option text so the LLM sees words, not indices.
    // INTERACTIVE: serialise vizState so the submission is inspectable (capped at 2 KB).
    // FREE_TEXT / MATH: use the raw string.
    const selectedIndex = typeof answer === 'number' ? answer : parseInt(String(answer))
    const rawOptions    = exercise.options
    const safeOptions: string[] | null =
      Array.isArray(rawOptions) && rawOptions.every((o): o is string => typeof o === 'string')
        ? rawOptions
        : null

    const answerText: string =
      exercise.type === 'MULTIPLE_CHOICE'
        ? String(safeOptions?.[selectedIndex] ?? answer)
        : exercise.type === 'INTERACTIVE'
        ? JSON.stringify((req.body as { vizState?: unknown }).vizState ?? {}).slice(0, 2000)
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

    // ── Steps 2–4: Update scores ──────────────────────────────────────────────
    let primaryEffective: number

    if (isPhase1) {
      // Phase 1: set score to 50 if correct and currently < 50. Never additive.
      if (correct) {
        // Batch fetch all existing progress rows in one query instead of one per concept.
        const existingRows = await prisma.studentConceptProgress.findMany({
          where: { userId: req.user!.id, conceptId: { in: conceptIds } },
          select: { conceptId: true, score: true },
        })
        const existingMap = new Map(existingRows.map(r => [r.conceptId, r.score]))

        await Promise.all(conceptIds
          .filter(conceptId => {
            const score = existingMap.get(conceptId)
            return score === undefined || score < 50
          })
          .map(conceptId => prisma.studentConceptProgress.upsert({
            where:  { userId_conceptId: { userId: req.user!.id, conceptId } },
            update: { score: 50 },
            create: { userId: req.user!.id, conceptId, score: 50 },
          }))
        )
      }
      primaryEffective = 0 // Phase 1 never triggers mastery events
    } else {
      // Phase 2: additive scoring
      const scoreResults = await Promise.all(
        conceptIds.map(conceptId => applyPhase2Score(req.user!.id, conceptId, scoreChange))
      )
      primaryEffective = scoreResults[0]?.effectiveScore ?? 0
    }

    // ── Step 5: Determine upcoming system events ──────────────────────────────
    // Fetch conceptLinks (needs fresh progress after score updates) and moduleData in parallel.
    const [conceptLinks, moduleData] = await Promise.all([
      prisma.moduleConcept.findMany({
        where:   { moduleId },
        orderBy: { order: 'asc' },
        include: {
          concept: {
            include: {
              theoryBlocks:    { orderBy: { order: 'asc' } },
              visualizations:  { orderBy: { order: 'asc' } },
              exerciseLinks:   { include: { exercise: { include: { conceptLinks: true } } } },
              progressEntries: { where: { userId: req.user!.id } },
            }
          }
        }
      }),
      prisma.courseModule.findUnique({
        where:  { id: moduleId },
        select: { name: true, whyThisModule: true, order: true, courseId: true },
      }),
    ])
    const history = earlyHistory

    const usedExerciseIds = new Set(
      history
        .filter(m => m.type === 'EXERCISE_CARD' || m.type === 'PRIOR_KNOWLEDGE_QUESTION')
        .map(m => (m.payload as any).exerciseId as number)
    )
    const theoryConceptsInHistory = new Set(
      history.filter(m => m.type === 'THEORY_BLOCK').map(m => (m.payload as any).conceptId as number)
    )

    const allConceptEffective = conceptLinks.map(cl => {
      const p = cl.concept.progressEntries[0]
      return {
        conceptId: cl.conceptId,
        effectiveScore: p ? applyDecay(p.score, p.lastActivityAt) : 0,
      }
    })

    const masteredNow = primaryEffective >= 90
    const allMastered = allConceptEffective.every(c => c.effectiveScore >= 90)

    type PendingEvent = { sseType: string; msgType: string; payload: any }
    const pendingEvents: PendingEvent[] = []

    // Phase 1 submissions never queue system events — the client calls /advance
    // after the stream ends, which owns all phase transitions (PKQ→PKQ, Phase 1→2).
    if (!isPhase1) {
      if (masteredNow) {
        pendingEvents.push({
          sseType: 'system:concept_mastery_reached',
          msgType: 'CONCEPT_MASTERY_REACHED',
          payload:  { conceptId: conceptIds[0], newEffectiveScore: primaryEffective },
        })
      }

      if (allMastered) {
        // moduleData already has courseId and order from the parallel fetch above — no extra round-trip needed.
        const nextModule = moduleData
          ? await prisma.courseModule.findFirst({
              where:   { courseId: moduleData.courseId, order: { gt: moduleData.order } },
              orderBy: { order: 'asc' },
              select:  { id: true },
            })
          : null

        pendingEvents.push({
          sseType: 'system:module_end_reached',
          msgType: 'MODULE_END_REACHED',
          payload:  { conceptScores: allConceptEffective, nextModuleId: nextModule?.id },
        })
      } else if (!masteredNow) {
        // Find next exercise in the concept loop
        for (const cl of conceptLinks) {
          const p = cl.concept.progressEntries[0]
          const eff = p ? applyDecay(p.score, p.lastActivityAt) : 0
          if (eff >= 90) continue

          if (!theoryConceptsInHistory.has(cl.conceptId)) {
            const blocks = cl.concept.theoryBlocks.map(tb => tb.content)
            const visualizations = cl.concept.visualizations.map(v => ({
              id: v.id, order: v.order,
              visualizationType: v.visualizationType,
              visualizationParams: v.visualizationParams as Record<string, unknown>,
              visualization: v.visualization ?? null,
            }))
            const visualization = visualizations.length === 0 ? (cl.concept.visualization ?? null) : null
            pendingEvents.push({
              sseType: 'system:theory_block',
              msgType: 'THEORY_BLOCK',
              payload: { conceptId: cl.conceptId, blocks, visualizations, visualization },
            })
          }

          const nextEx = cl.concept.exerciseLinks
            .map(el => el.exercise)
            .filter(ex => ex.courseModuleId === moduleId2 && !usedExerciseIds.has(ex.id) && ex.id !== exerciseId)
            .sort((a, b) => a.order - b.order)[0]

          if (nextEx) {
            pendingEvents.push({
              sseType: 'system:exercise_card',
              msgType: 'EXERCISE_CARD',
              payload:  { exerciseId: nextEx.id, submitted: false },
            })
          }
          break
        }
      }
    }

    // ── Step 6: Reserve AI message row + mutate exercise card ────────────────
    // The AI text is streamed live. We create a placeholder now so its order
    // value is assigned before any subsequent free-chat messages, ensuring the
    // feedback appears in the right position on returning visits.
    // System events (theory block, next exercise) are NOT pre-persisted here —
    // they are emitted via SSE only. /advance persists them when the student is
    // actually ready to see them, preventing ordering conflicts if the student
    // sends a free-chat message before revealing the next step.
    const aiMessageOrder = earlyHistory.length > 0 ? earlyHistory[earlyHistory.length - 1].order + 1 : 0
    const exerciseMsg = history.find(
      m => (m.type === 'EXERCISE_CARD' || m.type === 'PRIOR_KNOWLEDGE_QUESTION')
        && (m.payload as any).exerciseId === exerciseId
        && (m.payload as any).submitted === false
    )
    const [aiMessageRecord] = await Promise.all([
      prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role:      'AI',
          type:      'TEXT',
          payload:   { content: '' },
          order:     aiMessageOrder,
        },
      }),
      exerciseMsg
        ? prisma.chatMessage.update({
            where: { id: exerciseMsg.id },
            data:  { payload: { exerciseId, submitted: true, result: { correct, scoreChange, feedback } } },
          })
        : Promise.resolve(null),
    ])

    // ── Step 7: Stream AI feedback ────────────────────────────────────────────
    // moduleData was fetched in parallel with conceptLinks above — no extra round-trip.
    const theoryForContext = conceptLinks
      .filter(cl => conceptIds.includes(cl.conceptId))
      .flatMap(cl => cl.concept.theoryBlocks.map(tb => tb.content))
      .join('\n\n')

    const recentChat = history
      .filter(m => m.role !== 'SYSTEM' && m.type === 'TEXT')
      .slice(-20)
      .map(m => ({
        role:    (m.role === 'AI' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: (m.payload as any).content as string,
      }))

    const answerForFeedback = exercise.type === 'INTERACTIVE'
      ? JSON.stringify((req.body as any).vizState ?? {})
      : String(answer)

    const exerciseContext = exercise.type === 'MULTIPLE_CHOICE'
      ? `Exercise (multiple choice): ${exercise.question}\nOptions: ${(exercise.options as string[] | null)?.map((o, i) => `${i}) ${o}`).join(', ') ?? 'N/A'}\nCorrect option index: ${exercise.correctIndex}`
      : exercise.type === 'FREE_TEXT'
      ? `Exercise (free text): ${exercise.question}\nSample answer: ${exercise.sampleAnswer ?? 'N/A'}\nRubric: ${exercise.rubric ?? 'N/A'}`
      : `Exercise (interactive): ${exercise.question}`

    const language = exercise.courseModule.course.language
    const outcomeLabel = correct ? 'CORRECT' : (savedGrading?.almost ? 'PARTIALLY CORRECT' : 'INCORRECT')
    const feedbackSystem = `You are a Socratic tutor giving feedback on one exercise submission. Focus only on this exercise — ignore any prior conversation context.
Respond in ${language}.

Module: ${moduleData?.name}. ${moduleData?.whyThisModule ?? ''}

Relevant theory:
${theoryForContext}

${exerciseContext}

The student's answer was: ${outcomeLabel}.

Instructions:
- Write 1–3 sentences of targeted, specific feedback.
- CORRECT: Affirm in one short sentence, then ask a question that deepens or extends the concept.
- PARTIALLY CORRECT: Acknowledge what was right, then ask one targeted question about the missing piece.
- INCORRECT: Ask one guiding question grounded in the theory above — do not reveal the answer or enumerate all mistakes.
- Use $...$ for inline math, $$...$$ for display math.`
    const feedbackMessages = [{ role: 'user' as const, content: `My answer: ${answerForFeedback}` }]
    llmLogger.info({ system: feedbackSystem, messages: feedbackMessages }, 'feedback:exercise — request')

    let aiContent = ''
    const { textStream, usage: feedbackUsage } = streamText({
      model:    getModel(),
      system:   feedbackSystem,
      messages: feedbackMessages,
    })

    for await (const chunk of textStream) {
      aiContent += chunk
      sseEmit(res, { type: 'token', content: chunk })
    }
    llmLogger.info({ response: aiContent, usage: await feedbackUsage }, 'feedback:exercise — response')

    // Emit upcoming system events after the AI text (SSE only — not persisted here)
    for (const ev of pendingEvents) {
      const ssePayload: any = ev.sseType === 'system:exercise_card' || ev.sseType === 'system:prior_knowledge_question'
        ? { exerciseId: ev.payload.exerciseId, exercise: await prisma.exercise.findUnique({ where: { id: ev.payload.exerciseId }, include: { conceptLinks: true } }).then(e => e ? toStudentExercise(e) : null) }
        : ev.payload
      if (ssePayload) sseEmit(res, { type: ev.sseType as any, payload: ssePayload })
    }

    sseEmit(res, { type: 'done' })
    res.end()

    // ── Step 8: Fill in AI TEXT content (row was created before system events) ─
    await prisma.chatMessage.update({
      where: { id: aiMessageRecord.id },
      data:  { payload: { content: aiContent } },
    })
  } catch (err) {
    logger.error({ err }, '[POST /exercises/:id/submit]')
    if (!res.headersSent) res.status(500).json({ error: 'Failed to submit exercise' })
    else res.end()
  }
})

// ---------------------------------------------------------------------------
// POST /session/messages — free chat
// ---------------------------------------------------------------------------

router.post('/messages', requireAuth, async (req: Request, res: Response) => {
  const moduleId = parseInt(req.params.moduleId as string)
  const {
    content,
    richContent,
    attachments = [],
  } = req.body as {
    content:      string
    richContent?: unknown
    attachments?: Array<{ url: string; filename: string }>
  }
  if (!content?.trim()) { res.status(400).json({ error: 'content required' }); return }

  // Validate richContent: must be a plain object if present, and not unreasonably large
  if (richContent != null) {
    if (typeof richContent !== 'object' || Array.isArray(richContent)) {
      res.status(400).json({ error: 'richContent must be an object' }); return
    }
    if (JSON.stringify(richContent).length > 50_000) {
      res.status(400).json({ error: 'richContent exceeds size limit' }); return
    }
  }

  // Validate attachment URLs: must originate from our Supabase Storage bucket
  const allowedStorageOrigin = process.env.SUPABASE_PROJECT_URL
    ? new URL(process.env.SUPABASE_PROJECT_URL).origin + '/storage/v1/object/public/'
    : null
  if (attachments.length > 0) {
    if (!allowedStorageOrigin) {
      res.status(500).json({ error: 'Storage URL not configured' }); return
    }
    for (const att of attachments) {
      if (!att.url.startsWith(allowedStorageOrigin)) {
        res.status(400).json({ error: 'Invalid attachment URL' }); return
      }
    }
  }

  try {
    const session = await prisma.moduleSession.findUnique({
      where: { userId_moduleId: { userId: req.user!.id, moduleId } },
    })
    if (!session) { res.status(404).json({ error: 'Session not found' }); return }

    // Fetch history and module data in parallel before creating any messages
    const [existingHistory, moduleData] = await Promise.all([
      prisma.chatMessage.findMany({ where: { sessionId: session.id }, orderBy: { order: 'asc' } }),
      prisma.courseModule.findUnique({
        where:  { id: moduleId },
        select: {
          name:          true,
          whyThisModule: true,
          objectives:    { select: { text: true } },
          course:        { select: { language: true, subject: true } },
          conceptLinks:  {
            select: {
              concept: {
                select: {
                  name:        true,
                  theoryBlocks: { select: { content: true }, orderBy: { order: 'asc' } },
                },
              },
            },
          },
        },
      }),
    ])

    let orderCounter = existingHistory.length > 0
      ? existingHistory[existingHistory.length - 1].order + 1
      : 0

    // Persist student message
    await prisma.chatMessage.create({
      data: {
        sessionId: session.id, role: 'STUDENT', type: 'TEXT',
        payload: {
          content,
          ...(richContent != null ? { richContent } : {}),
          ...(attachments.length ? { attachments } : {}),
        },
        order: orderCounter++,
      },
    })

    // Build recentChat from existing history + the student message we just persisted
    const recentChat = [...existingHistory, { role: 'STUDENT', type: 'TEXT', payload: { content, attachments } }]
      .filter(m => m.role !== 'SYSTEM' && m.type === 'TEXT')
      .slice(-20)
      .map(m => {
        const p    = m.payload as { content: string; attachments?: Array<{ url: string }> }
        const role = (m.role === 'AI' ? 'assistant' : 'user') as 'assistant' | 'user'

        if (p.attachments?.length) {
          return {
            role,
            content: [
              { type: 'text' as const,  text:  p.content },
              ...p.attachments.map(a => ({
                type:  'image' as const,
                image: new URL(a.url),
              })),
            ],
          }
        }

        return { role, content: p.content }
      })

    sseOpen(res)

    const chatLanguage = moduleData?.course.language ?? 'English'
    const chatObjectives = moduleData?.objectives.map(o => `- ${o.text}`).join('\n') ?? ''
    const chatTheory = moduleData?.conceptLinks
      .map(cl => `### ${cl.concept.name}\n${cl.concept.theoryBlocks.map(tb => tb.content).join('\n\n')}`)
      .join('\n\n') ?? ''

    const chatSystem = [
      `You are a Socratic tutor for the module "${moduleData?.name}" in a course on ${moduleData?.course.subject ?? 'this subject'}.`,
      `Respond in ${chatLanguage}.`,
      '',
      'Your role: guide students toward understanding through focused questions. Do not state answers directly.',
      'Ask one question at a time that helps the student reason toward the concept.',
      'When relevant, reference specific ideas from the theory below rather than asking generic questions.',
      '',
      moduleData?.whyThisModule ? `Module purpose: ${moduleData.whyThisModule}` : '',
      chatObjectives ? `\nLearning objectives:\n${chatObjectives}` : '',
      chatTheory ? `\nTheory the student has seen:\n${chatTheory}` : '',
      '',
      'Formatting: use $...$ for inline math, $$...$$ for display math.',
    ].filter(line => line !== undefined).join('\n').trim()
    llmLogger.info({ system: chatSystem, messages: recentChat }, 'chat:message — request')

    let aiContent = ''
    const { textStream, usage: chatUsage } = streamText({
      model:    getModel(),
      system:   chatSystem,
      messages: recentChat as ModelMessage[],
    })

    for await (const chunk of textStream) {
      aiContent += chunk
      sseEmit(res, { type: 'token', content: chunk })
    }
    llmLogger.info({ response: aiContent, usage: await chatUsage }, 'chat:message — response')

    sseEmit(res, { type: 'done' })
    res.end()

    await prisma.chatMessage.create({
      data: {
        sessionId: session.id, role: 'AI', type: 'TEXT',
        payload: { content: aiContent }, order: orderCounter++,
      },
    })
  } catch (err) {
    llmLogger.error({ err }, '[POST /messages]')
    if (!res.headersSent) res.status(500).json({ error: 'Failed to send message' })
    else res.end()
  }
})

export default router
