import { Router } from 'express'
import { CourseStatus, Prisma } from '@prisma/client'
import prisma from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { triggerGeneration } from '../services/courseGeneration'
import { logger, llmLogger } from '../lib/logger'
import { CourseWizardInput, CourseListItem, CourseDetail, ReviewStatus, CourseConcept, CourseExercise, GetCourseAnalyticsResponse } from '@metis/types'
import { computeProgress, latestSession, pickGranularity } from '../lib/analytics'

const router = Router()

export function buildObjectivesData(
  modules: Array<{ order: number; objectives: Array<{ text: string }> }>,
  dbModules: Array<{ id: number; order: number }>,
): Array<{ text: string; courseModuleId: number }> {
  const idByOrder = new Map(dbModules.map(m => [m.order, m.id]))
  return modules.flatMap((m) => {
    const moduleId = idByOrder.get(m.order)
    if (moduleId === undefined) return []
    return m.objectives.map(o => ({ text: o.text, courseModuleId: moduleId }))
  })
}

export function buildOutcomesData(
  modules: Array<{ order: number; outcomes: Array<{ text: string }> }>,
  dbModules: Array<{ id: number; order: number }>,
): Array<{ text: string; courseModuleId: number }> {
  const idByOrder = new Map(dbModules.map(m => [m.order, m.id]))
  return modules.flatMap((m) => {
    const moduleId = idByOrder.get(m.order)
    if (moduleId === undefined) return []
    return m.outcomes.map(o => ({ text: o.text, courseModuleId: moduleId }))
  })
}

router.post('/', requireAuth, async (req, res) => {
  const body = req.body as CourseWizardInput

  try {

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
        where:   { courseId: course.id },
        select:  { id: true, order: true },
        orderBy: { order: 'asc' as const },
      })

      // Phase 4 — objectives and outcomes in two bulk INSERTs
      const modulesWithOrder = body.modules.map((m, index) => ({ ...m, order: index }))

      await tx.learningObjective.createMany({
        data: buildObjectivesData(modulesWithOrder, dbModules),
      })

      await tx.learningOutcome.createMany({
        data: buildOutcomesData(modulesWithOrder, dbModules),
      })

      return course.id
    })

    // Fire generation in the background — do NOT await this.
    // The teacher gets a response immediately; generation runs async.
    triggerGeneration(courseId).catch(err => llmLogger.error({ err }, 'triggerGeneration failed'))

    res.status(201).json({ courseId: courseId })
  } catch (err) {
    logger.error({ err }, '[POST /api/courses]')
    res.status(500).json({ error: 'Failed to create course' })
  }
})

router.get('/', requireAuth, async (req, res) => {
  try {

    const courses: CourseListItem[] = await prisma.course.findMany({
      where: { teacherId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        subject: true,
        status: true,
        createdAt: true
      }
    }).then(results => results.map(c => ({
      id: c.id,
      name: c.name,
      subject: c.subject,
      status: c.status as CourseStatus,
      createdAt: c.createdAt.toISOString()
    } as CourseListItem )))

    res.json(courses)
  } catch (err) {
    logger.error({ err }, '[GET /api/courses]')
    res.status(500).json({ error: 'Failed to fetch courses' })
  }
})

router.get('/:id', requireAuth, async (req, res) => {
  const courseId = parseInt(req.params.id as string)
  if (isNaN(courseId)) { res.status(400).json({ error: 'Invalid course ID' }); return }

  const include = Prisma.validator<Prisma.CourseInclude>()({
    courseModules: {
      orderBy: { order: 'asc' as const },
      include: {
        objectives: true,
        outcomes: true,
        conceptLinks: {
          orderBy: { order: 'asc' as const },
          include: {
            concept: {
              include: {
                theoryBlocks:    { orderBy: { order: 'asc' as const } },
                visualizations:  { orderBy: { order: 'asc' as const } },
              }
            }
          }
        },
        exercises: {
          orderBy: { order: 'asc' as const },
          include: { conceptLinks: true }
        }
      }
    }
  })

  type RawCourse = Prisma.CourseGetPayload<{ include: typeof include }>


  try {
    const userRole = await prisma.user
      .findUnique({ where: { supabaseId: req.user!.id }, select: { role: true } })
      .then((u) => u?.role)

    if (!userRole) { res.status(403).json({ error: 'User not found' }); return }

    let rawCourse: RawCourse | null = null

    if (userRole === 'TEACHER') {
      rawCourse = await prisma.course.findFirst({
        where: { id: courseId, teacherId: req.user!.id },
        include,
      })
    } else if (userRole === 'STUDENT') {
      rawCourse = await prisma.course.findFirst({
        where: {
          id: courseId,
          status: 'PUBLISHED',
          enrollments: { some: { userId: req.user!.id, status: 'ACTIVE' } },
        },
        include,
      })
    }

    if (!rawCourse) { res.status(404).json({ error: 'Course not found' }); return }

    const courseDetail: CourseDetail = {
      id: rawCourse.id,
      name: rawCourse.name,
      subject: rawCourse.subject,
      language: rawCourse.language,
      targetAudience: rawCourse.targetAudience,
      status: rawCourse.status as CourseStatus,
      modules: rawCourse.courseModules.map(m => ({
        id: m.id,
        name: m.name,
        order: m.order,
        reviewStatus: m.reviewStatus as ReviewStatus,
        whyThisModule: m.whyThisModule,
        buildsOn: m.buildsOn,
        leadsInto: m.leadsInto,
        objectives: m.objectives.map(o => ({ id: o.id, text: o.text })),
        outcomes: m.outcomes.map(o => ({ id: o.id, text: o.text })),
        concepts: m.conceptLinks.map(cl => ({
          id: cl.conceptId,
          name: cl.concept.name,
          order: cl.order,
          conceptType: cl.concept.conceptType ?? undefined,
          theoryBlocks: cl.concept.theoryBlocks.map(tb => ({
            id: tb.id,
            order: tb.order,
            pendingRevision: tb.pendingRevision,
            content: tb.content
          })),
          visualizations: cl.concept.visualizations.map(v => ({
            id: v.id,
            order: v.order,
            visualizationType: v.visualizationType,
            visualizationParams: v.visualizationParams as Record<string, unknown>,
            visualization: v.visualization ?? undefined,
          })),
        })),
        exercises: m.exercises.map(ex => ({
          id: ex.id,
          order: ex.order,
          pendingRevision: ex.pendingRevision,
          type: ex.type,
          question: ex.question,
          conceptIds: ex.conceptLinks.map(cl => cl.conceptId),
          options: ex.options as string[] | null,
          correctIndex: ex.correctIndex,
          explanation: ex.explanation,
          sampleAnswer: ex.sampleAnswer,
          rubric: ex.rubric,
          visualizationHtml:   ex.visualizationHtml ?? null,
          visualizationType:   ex.visualizationType ?? null,
          visualizationParams: ex.visualizationParams as Record<string, unknown> | null ?? null,
          targetState:         ex.targetState as Record<string, number> | null ?? null,
        }))
      }))
    }

    res.json(courseDetail)

  } catch (err) {
    logger.error({ err }, '[GET /api/courses/:id]')
    res.status(500).json({ error: 'Failed to fetch course' })
  }
})

router.patch('/:id', requireAuth, async (req, res) => {
  const courseId = parseInt(req.params.id as string)
  if (isNaN(courseId)) { res.status(400).json({ error: 'Invalid course ID' }); return }

  const { status } = req.body as { status: string }
  if (status !== 'PUBLISHED' && status !== 'UNPUBLISHED' && status !== 'ARCHIVED') {
    res.status(400).json({ error: 'Invalid status' }); return
  }

  try {
    const course = await prisma.course.findFirst({
      where: { id: courseId, teacherId: req.user!.id },
      include: { courseModules: { select: { reviewStatus: true } } },
    })
    if (!course) { res.status(404).json({ error: 'Course not found' }); return }

    if (status === 'PUBLISHED') {
      const allApproved = course.courseModules.every(m => m.reviewStatus === 'APPROVED')
      if (!allApproved) {
        res.status(422).json({ error: 'All modules must be approved before publishing' }); return
      }
    }

    await prisma.course.update({ where: { id: courseId }, data: { status } })
    res.status(204).send()
  } catch (err) {
    logger.error({ err }, '[PATCH /api/courses/:id]')
    res.status(500).json({ error: 'Failed to update course' })
  }
})

// POST /api/courses/:id/enrollments — teacher invites a student by email
router.post('/:id/enrollments', requireAuth, async (req, res) => {
  const courseId = parseInt(req.params.id as string)
  if (isNaN(courseId)) { res.status(400).json({ error: 'Invalid course ID' }); return }

  const { email } = req.body as { email: string }
  if (typeof email !== 'string' || !email.trim()) {
    res.status(400).json({ error: 'email is required' }); return
  }

  try {
    const course = await prisma.course.findFirst({ where: { id: courseId, teacherId: req.user!.id } })
    if (!course) { res.status(404).json({ error: 'Course not found' }); return }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: { courseId_email: { courseId, email: email.trim() } },
    })

    if (existingEnrollment) {
      if (existingEnrollment.status === 'REJECTED') {
        // Re-invite: reset the existing record back to PENDING
        const updated = await prisma.enrollment.update({
          where: { id: existingEnrollment.id },
          data: { status: 'PENDING', userId: null },
        })
        res.status(200).json({ id: updated.id, status: updated.status })
      } else {
        res.status(409).json({ error: 'This email has already been invited' })
      }
      return
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        courseId,
        email: email.trim(),
        userId: null,
        status: 'PENDING',
      },
    })

    res.status(201).json({ id: enrollment.id, status: enrollment.status })
  } catch (err: any) {
    logger.error({ err }, '[POST /api/courses/:id/enrollments]')
    res.status(500).json({ error: 'Failed to create enrollment' })
  }
})

// GET /api/courses/:id/enrollments — teacher fetches student list
router.get('/:id/enrollments', requireAuth, async (req, res) => {
  const courseId = parseInt(req.params.id as string)
  if (isNaN(courseId)) { res.status(400).json({ error: 'Invalid course ID' }); return }

  try {
    const course = await prisma.course.findFirst({ where: { id: courseId, teacherId: req.user!.id } })
    if (!course) { res.status(404).json({ error: 'Course not found' }); return }

    const enrollments = await prisma.enrollment.findMany({
      where: { courseId, status: { in: ['PENDING', 'ACTIVE'] } },
      orderBy: { createdAt: 'desc' },
    })

    res.json(enrollments.map(e => ({
      id: e.id,
      email: e.email,
      status: e.status,
      userId: e.userId,
      createdAt: e.createdAt.toISOString(),
    })))
  } catch (err) {
    logger.error({ err }, '[GET /api/courses/:id/enrollments]')
    res.status(500).json({ error: 'Failed to fetch enrollments' })
  }
})

// POST /api/courses/:id/generate — retrigger generation for a FAILED course
router.post('/:id/generate', requireAuth, async (req, res) => {
  const courseId = parseInt(req.params.id as string)
  if (isNaN(courseId)) { res.status(400).json({ error: 'Invalid course ID' }); return }

  try {
    const course = await prisma.course.findUnique({ where: { id: courseId, teacherId: req.user!.id } })
    if (!course) { res.status(404).json({ error: 'Course not found' }); return }
    if (course.status !== 'FAILED') { res.status(409).json({ error: 'Course is not in a failed state' }); return }

    await prisma.course.update({ where: { id: courseId }, data: { status: 'GENERATING' } })
    triggerGeneration(courseId).catch(err => llmLogger.error({ err }, 'triggerGeneration failed'))
    res.status(202).json({ message: 'Generation started' })
  } catch (err) {
    logger.error({ err }, '[POST /api/courses/:id/generate]')
    res.status(500).json({ error: 'Failed to start generation' })
  }
})

// GET /api/courses/:id/analytics — teacher fetches per-student progress for a course
router.get('/:id/analytics', requireAuth, async (req, res) => {
  const courseId = parseInt(req.params.id as string)
  if (isNaN(courseId)) { res.status(400).json({ error: 'Invalid course ID' }); return }

  try {
    // Verify the course exists and belongs to this teacher
    const course = await prisma.course.findFirst({
      where: { id: courseId, teacherId: req.user!.id },
      select: { id: true },
    })
    if (!course) { res.status(404).json({ error: 'Course not found' }); return }

    // Round 1 — enrolled students + preflight date range in parallel (both only need courseId)
    const [enrollments, [rangeRow]] = await Promise.all([
      prisma.enrollment.findMany({
        where: { courseId, status: 'ACTIVE' },
        select: {
          userId: true,
          student: { select: { user: { select: { email: true } } } },
        },
      }),
      prisma.$queryRaw<{ min: Date | null; max: Date | null }[]>`
        SELECT MIN("createdAt") AS min, MAX("createdAt") AS max
        FROM "ExerciseAttempt"
        WHERE "courseId" = ${courseId}
      `,
    ])

    const validEnrollments = enrollments.filter(
      (e): e is typeof e & { userId: string; student: NonNullable<typeof e.student> } =>
        e.userId !== null && e.student !== null
    )

    if (validEnrollments.length === 0) {
      res.json({ students: [], attemptsOverTime: [], granularity: 'day' } satisfies GetCourseAnalyticsResponse)
      return
    }

    const userIds = validEnrollments.map(e => e.userId)
    const granularity = pickGranularity(rangeRow!.min, rangeRow!.max)

    // Round 2 — progress, sessions, and attempt time-series in parallel, scoped to this course
    const [progressRows, sessionRows, attemptRows] = await Promise.all([
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
    ])

    // Group rows by userId for O(n) lookup
    const progressByUser = new Map<string, { score: number; lastActivityAt: Date }[]>()
    for (const row of progressRows) {
      if (!progressByUser.has(row.userId)) progressByUser.set(row.userId, [])
      progressByUser.get(row.userId)!.push({ score: row.score, lastActivityAt: row.lastActivityAt })
    }

    const sessionsByUser = new Map<string, { updatedAt: Date }[]>()
    for (const row of sessionRows) {
      if (!sessionsByUser.has(row.userId)) sessionsByUser.set(row.userId, [])
      sessionsByUser.get(row.userId)!.push({ updatedAt: row.updatedAt })
    }

    const students = validEnrollments
      .map(e => ({
        email: e.student.user.email,
        progress: computeProgress(progressByUser.get(e.userId) ?? []),
        lastActiveAt: latestSession(sessionsByUser.get(e.userId) ?? []),
      }))
      // Default sort: most recently active first; nulls last
      .sort((a, b) => {
        const av = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0
        const bv = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0
        return bv - av
      })

    const result: GetCourseAnalyticsResponse = {
      students,
      granularity,
      attemptsOverTime: attemptRows.map(r => ({
        date:      r.date.toISOString(),
        correct:   Number(r.correct),
        incorrect: Number(r.incorrect),
        total:     Number(r.total),
      })),
    }

    res.json(result)
  } catch (err) {
    logger.error({ err }, '[GET /api/courses/:id/analytics]')
    res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  const courseId = parseInt(req.params.id as string)
  if (isNaN(courseId)) { res.status(400).json({ error: 'Invalid course ID' }); return }

  try {
    await prisma.course.delete({ where: { id: courseId, teacherId: req.user!.id } })
    res.status(204).send()
  } catch (err: any) {
    if (err?.code === 'P2025') { res.status(404).json({ error: 'Course not found' }); return }
    logger.error({ err }, '[DELETE /api/courses/:id]')
    res.status(500).json({ error: 'Failed to delete course' })
  }
})

export default router
