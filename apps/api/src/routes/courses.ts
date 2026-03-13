import { Router } from 'express'
import { CourseStatus, PrismaClient } from '@prisma/client'
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

  try {

    const rawCourse = await prisma.course.findUniqueOrThrow({
      where: { id: courseId, teacherId: req.user!.id },
      include: {
        courseModules: {
          orderBy: { order: 'asc' },
          include: {
            objectives: true,
            outcomes: true,
            conceptLinks: {
              orderBy: { order: 'asc' },
              include: {
                concept: {
                  include: {
                    theoryBlocks: {
                      orderBy: {
                        order: 'asc'
                      }
                    }
                  }
                }
              }
            },
            exercises: {
              orderBy: { order: 'asc' },
              include: {
                conceptLinks: true
              }
            }
          }
        }
      }
    })

    const courseDetail: CourseDetail = {
      id: rawCourse.id,
      name: rawCourse.name,
      subject: rawCourse.subject,
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

  } catch (err: any) {
    if (err?.code === 'P2025') { res.status(404).json({ error: 'Course not found' }); return }
    console.error('[GET /api/courses/:id]', err)
    res.status(500).json({ error: 'Failed to fetch course' })
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
