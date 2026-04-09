import { Router } from 'express'
import { CourseStatus, ReviewStatus } from '@prisma/client'
import prisma from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { logger } from '../lib/logger'
import { GetStudentCoursesResponse, GetStudentInvitesResponse, CourseOverview, GetCourseModuleResponse, StudentCourseModule, ReviewConcept } from '@metis/types'
import { getCachedModule, setCachedModule } from '../lib/cache'
import { applyDecay } from '../lib/decay'

const router = Router()

// GET /api/student/courses — returns all courses the student is enrolled in or invited to
//
// ACTIVE enrollments are found by userId (the student accepted and has an account).
// PENDING enrollments are found by email — the student may have been invited before
// they signed up, so there is no userId yet to match on.
router.get('/courses', requireAuth, async (req, res) => {
  try {
    const active = await prisma.enrollment.findMany({
      where: { userId: req.user!.id, status: 'ACTIVE' },
      include: { course: { select: { id: true, name: true, subject: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const courseIds = active.map(e => e.course.id)

    // Fetch last-visited module per course and concept progress — both in parallel,
    // only when there are active enrollments to avoid unnecessary queries.
    const [sessions, progressRows] = courseIds.length > 0 ? await Promise.all([
      prisma.moduleSession.findMany({
        where: { userId: req.user!.id, module: { courseId: { in: courseIds } } },
        orderBy: { updatedAt: 'desc' },
        select: { module: { select: { id: true, name: true, courseId: true } } },
      }),
      prisma.studentConceptProgress.findMany({
        where: { userId: req.user!.id, concept: { courseId: { in: courseIds } } },
        select: { score: true, lastActivityAt: true, concept: { select: { courseId: true } } },
      }),
    ]) : [[], []]

    // Sessions are ordered desc — first entry per course is the most recent
    const lastSessionByCourse = new Map<number, { moduleId: number; moduleName: string }>()
    for (const s of sessions) {
      const courseId = s.module.courseId
      if (!lastSessionByCourse.has(courseId)) {
        lastSessionByCourse.set(courseId, { moduleId: s.module.id, moduleName: s.module.name })
      }
    }

    // Group effective scores by course for overall progress average
    const scoresByCourse = new Map<number, number[]>()
    for (const p of progressRows) {
      const courseId = p.concept.courseId
      if (!scoresByCourse.has(courseId)) scoresByCourse.set(courseId, [])
      scoresByCourse.get(courseId)!.push(applyDecay(p.score, p.lastActivityAt))
    }

    const result: GetStudentCoursesResponse = active.map(e => {
      const lastSession = lastSessionByCourse.get(e.course.id)
      const scores = scoresByCourse.get(e.course.id) ?? []
      const overallProgress = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0
      return {
        enrollmentId: e.id,
        enrollmentStatus: 'ACTIVE' as const,
        course: { id: e.course.id, name: e.course.name, subject: e.course.subject, status: e.course.status as CourseStatus },
        lastModuleId: lastSession?.moduleId ?? null,
        lastModuleName: lastSession?.moduleName ?? null,
        overallProgress,
      }
    })

    res.json(result)
  } catch (err) {
    logger.error({ err }, '[GET /api/student/courses]')
    res.status(500).json({ error: 'Failed to fetch courses' })
  }
})

// GET /api/student/invites — returns only PENDING enrollments for the authenticated student.
// Kept separate from /courses so the dashboard can cache invite data independently
// and invalidate it precisely when an invite is accepted or rejected.
router.get('/invites', requireAuth, async (req, res) => {
  try {
    const pending = await prisma.enrollment.findMany({
      where: { email: req.user!.email, status: 'PENDING' },
      include: { course: { select: { id: true, name: true, subject: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const result: GetStudentInvitesResponse = pending.map(e => ({
      enrollmentId: e.id,
      course: { id: e.course.id, name: e.course.name, subject: e.course.subject },
    }))

    res.json(result)
  } catch (err) {
    logger.error({ err }, '[GET /api/student/invites]')
    res.status(500).json({ error: 'Failed to fetch invites' })
  }
})

// GET /api/student/courses/:id/overview — lightweight course shape for student overview and
// module landing pages. Does not fetch theory blocks or exercises.
router.get('/courses/:id/overview', requireAuth, async (req, res) => {
  const courseId = parseInt(req.params.id as string)
  if (isNaN(courseId)) { res.status(400).json({ error: 'Invalid course ID' }); return }

  try {
    const raw = await prisma.course.findFirst({
      where: {
        id: courseId,
        status: 'PUBLISHED',
        enrollments: { some: { userId: req.user!.id, status: 'ACTIVE' } },
      },
      select: {
        id: true,
        name: true,
        subject: true,
        status: true,
        courseModules: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            name: true,
            order: true,
            whyThisModule: true,
            buildsOn: true,
            leadsInto: true,
            outcomes: { select: { id: true, text: true } },
            conceptLinks: {
              orderBy: { order: 'asc' },
              select: {
                order: true,
                concept: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    if (!raw) { res.status(404).json({ error: 'Course not found' }); return }

    const overview: CourseOverview = {
      id: raw.id,
      name: raw.name,
      subject: raw.subject,
      status: raw.status as CourseStatus,
      modules: raw.courseModules.map(m => ({
        id: m.id,
        name: m.name,
        order: m.order,
        whyThisModule: m.whyThisModule,
        buildsOn: m.buildsOn,
        leadsInto: m.leadsInto,
        outcomes: m.outcomes,
        concepts: m.conceptLinks.map(cl => ({ id: cl.concept.id, name: cl.concept.name, order: cl.order })),
      })),
    }

    res.json(overview)
  } catch (err) {
    logger.error({ err }, '[GET /api/student/courses/:id/overview]')
    res.status(500).json({ error: 'Failed to fetch course overview' })
  }
})

// GET /api/student/courses/:courseId/modules/:moduleId — full detail for a single module.
// Used by the session page, which only needs one module's concepts, theory blocks, and exercises.
router.get('/courses/:courseId/modules/:moduleId', requireAuth, async (req, res) => {
  const courseId = parseInt(req.params.courseId as string)
  const moduleId = parseInt(req.params.moduleId as string)
  if (isNaN(courseId) || isNaN(moduleId)) { res.status(400).json({ error: 'Invalid ID' }); return }

  try {
    const cached = await getCachedModule(moduleId)
    if (cached) {
      res.json(cached)
      return
    }

    // Verify enrollment and fetch module content in parallel — neither depends on the other.
    // Enrollment check must still pass before we return any data.
    const [course, rawModule] = await Promise.all([
      prisma.course.findFirst({
        where: {
          id: courseId,
          status: 'PUBLISHED',
          enrollments: { some: { userId: req.user!.id, status: 'ACTIVE' } },
        },
        select: {
          name: true,
          courseModules: { orderBy: { order: 'asc' }, select: { id: true, name: true, order: true } },
        },
      }),
      prisma.courseModule.findFirst({
        where: { id: moduleId, courseId },
        include: {
          objectives: true,
          outcomes: true,
          conceptLinks: {
            orderBy: { order: 'asc' },
            include: {
              concept: {
                include: {
                  theoryBlocks:   { orderBy: { order: 'asc' } },
                  visualizations: { orderBy: { order: 'asc' } },
                },
              },
            },
          },
          exercises: {
            orderBy: { order: 'asc' },
            include: { conceptLinks: true },
          },
        },
      }),
    ])

    if (!course) { res.status(404).json({ error: 'Course not found' }); return }
    if (!rawModule) { res.status(404).json({ error: 'Module not found' }); return }

    const module: StudentCourseModule = {
      id: rawModule.id,
      name: rawModule.name,
      order: rawModule.order,
      reviewStatus: rawModule.reviewStatus as ReviewStatus,
      whyThisModule: rawModule.whyThisModule,
      buildsOn: rawModule.buildsOn,
      leadsInto: rawModule.leadsInto,
      objectives: rawModule.objectives.map(o => ({ id: o.id, text: o.text })),
      outcomes: rawModule.outcomes.map(o => ({ id: o.id, text: o.text })),
      concepts: rawModule.conceptLinks.map(cl => ({
        id:           cl.conceptId,
        name:         cl.concept.name,
        order:        cl.order,
        conceptType:  cl.concept.conceptType ?? undefined,
        theoryBlocks: cl.concept.theoryBlocks.map(tb => ({
          id: tb.id, order: tb.order, pendingRevision: tb.pendingRevision, content: tb.content,
        })),
        visualization:  cl.concept.visualization ?? undefined,   // legacy fallback — kept
        visualizations: cl.concept.visualizations.map(v => ({
          id:                  v.id,
          order:               v.order,
          visualizationType:   v.visualizationType,
          visualizationParams: v.visualizationParams as Record<string, unknown>,
          visualization:       v.visualization ?? undefined,
        })),
      })),
      // correctIndex, sampleAnswer, rubric, targetState intentionally omitted — answer fields stay server-side
      exercises: rawModule.exercises.map(ex => ({
        id: ex.id,
        order: ex.order,
        pendingRevision: ex.pendingRevision,
        type: ex.type,
        question: ex.question,
        conceptIds: ex.conceptLinks.map(cl => cl.conceptId),
        options: ex.options as string[] | null,
        explanation: ex.explanation,
        visualizationHtml:   ex.visualizationHtml ?? null,
        visualizationType:   ex.visualizationType ?? null,
        visualizationParams: ex.visualizationParams as Record<string, unknown> | null ?? null,
      })),
    }

    const response: GetCourseModuleResponse = {
      courseName: course.name,
      module,
      allModules: course.courseModules,
    }

    // Fire-and-forget — the client shouldn't wait for a Redis write that only benefits future requests.
    setCachedModule(moduleId, response).catch(err => logger.error({ err }, '[cache] setCachedModule failed'))
    res.json(response)
  } catch (err) {
    logger.error({ err }, '[GET /api/student/courses/:courseId/modules/:moduleId]')
    res.status(500).json({ error: 'Failed to fetch module' })
  }
})

// GET /api/student/courses/:id/progress — returns effective scores per concept for
// the authenticated student scoped to the given course.
//
// The effective score applies a 10%-per-unit decay to the raw score:
//   effectiveScore = score × (0.9 ^ unitsSinceLastActivity)
// This is computed here so that all frontend surfaces show consistent values and
// the decay rate has a single place to change.
router.get('/courses/:id/progress', requireAuth, async (req, res) => {
  const courseId = parseInt(req.params.id as string)
  if (isNaN(courseId)) { res.status(400).json({ error: 'Invalid course ID' }); return }

  try {
    const rows = await prisma.studentConceptProgress.findMany({
      where: {
        userId: req.user!.id,
        concept: { courseId },
      },
      select: {
        conceptId: true,
        score: true,
        lastActivityAt: true,
      },
    })

    res.json(rows.map(r => ({
      conceptId: r.conceptId,
      effectiveScore: applyDecay(r.score, r.lastActivityAt),
    })))
  } catch (err) {
    logger.error({ err }, '[GET /api/student/courses/:id/progress]')
    res.status(500).json({ error: 'Failed to fetch progress' })
  }
})

// GET /api/student/review — returns all concepts across active enrollments where
// the effective (decay-applied) score is below the mastery threshold.
//
// "Due for review" = the student has touched the concept (score > 0) but enough
// time has passed that decay has pushed the effective score below 90.
// Results are sorted ascending by effectiveScore so the most-urgent concepts appear first.
router.get('/review', requireAuth, async (req, res) => {
  const MASTERY_THRESHOLD = 90

  try {
    const rows = await prisma.studentConceptProgress.findMany({
      where: {
        userId: req.user!.id,
        score: { gt: 0 },
        concept: {
          course: {
            enrollments: { some: { userId: req.user!.id, status: 'ACTIVE' } },
          },
        },
      },
      select: {
        conceptId: true,
        score: true,
        lastActivityAt: true,
        concept: {
          select: {
            name: true,
            course: { select: { id: true, name: true } },
            moduleLinks: {
              take: 1,
              orderBy: { order: 'asc' },
              select: {
                module: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    const result: ReviewConcept[] = rows
      .map(r => ({
        conceptId: r.conceptId,
        conceptName: r.concept.name,
        moduleId: r.concept.moduleLinks[0]?.module.id ?? 0,
        moduleName: r.concept.moduleLinks[0]?.module.name ?? '',
        courseId: r.concept.course.id,
        courseName: r.concept.course.name,
        rawScore: r.score,
        effectiveScore: applyDecay(r.score, r.lastActivityAt),
        lastActivityAt: r.lastActivityAt.toISOString(),
      }))
      .filter(r => r.effectiveScore < MASTERY_THRESHOLD)
      .sort((a, b) => a.effectiveScore - b.effectiveScore)

    res.json(result)
  } catch (err) {
    logger.error({ err }, '[GET /api/student/review]')
    res.status(500).json({ error: 'Failed to fetch review concepts' })
  }
})

export default router
