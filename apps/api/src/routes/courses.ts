import { Router } from 'express'
import { CourseStatus, PrismaClient, Prisma } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { triggerGeneration } from '../services/courseGeneration'
import { CourseWizardInput, CourseListItem, CourseDetail, ReviewStatus, CourseConcept, CourseExercise } from '@metis/types'

const router = Router()
const prisma = new PrismaClient()

router.post('/', requireAuth, async (req, res) => {
  const body = req.body as CourseWizardInput

  try {

    const courseId: number = await prisma.$transaction(async (tx) => { 
      const course = await tx.course.create({
        data: {
          teacherId: req.user!.id, // req.user is guaranteed to be set by requireAuth middleware
          status: 'GENERATING',
          name: body.name,
          subject: body.subject,
          language: body.language,
          targetAudience: body.targetAudience,
          courseModules: {
            create: body.modules.map((m, index) => ({
              name: m.name,
              order: index,
              objectives: { create: m.objectives.map(o => ({ text: o.text })) },
              outcomes:   { create: m.outcomes.map(o => ({ text: o.text })) },
            }))
          }
        }
      })

      return course.id
    })

    // Fire generation in the background — do NOT await this.
    // The teacher gets a response immediately; generation runs async.
    triggerGeneration(courseId).catch(console.error)

    res.status(201).json({ courseId: courseId })
  } catch (err) {
    console.error('[POST /api/courses]', err)
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
    console.error('[GET /api/courses]', err)
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
                theoryBlocks: { orderBy: { order: 'asc' as const } }
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
          theoryBlocks: cl.concept.theoryBlocks.map(tb => ({
            id: tb.id,
            order: tb.order,
            pendingRevision: tb.pendingRevision,
            content: tb.content
          }))
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
          rubric: ex.rubric
        }))
      }))
    }

    res.json(courseDetail)

  } catch (err) {
    console.error('[GET /api/courses/:id]', err)
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
    console.error('[PATCH /api/courses/:id]', err)
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
    console.error('[POST /api/courses/:id/enrollments]', err)
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
    console.error('[GET /api/courses/:id/enrollments]', err)
    res.status(500).json({ error: 'Failed to fetch enrollments' })
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
    console.error('[DELETE /api/courses/:id]', err)
    res.status(500).json({ error: 'Failed to delete course' })
  }
})

export default router
