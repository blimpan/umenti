import { Router } from 'express'
import { PrismaClient, CourseStatus } from '@prisma/client'
import { requireAuth } from '../middleware/auth'
import { GetStudentCoursesResponse } from '@metis/types'

const router = Router()
const prisma = new PrismaClient()

// GET /api/student/courses — returns all courses the student is enrolled in or invited to
//
// ACTIVE enrollments are found by userId (the student accepted and has an account).
// PENDING enrollments are found by email — the student may have been invited before
// they signed up, so there is no userId yet to match on.
router.get('/courses', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { supabaseId: req.user!.id },
      select: { email: true },
    })
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    const [active, pending] = await Promise.all([
      prisma.enrollment.findMany({
        where: { userId: req.user!.id, status: 'ACTIVE' },
        include: { course: { select: { id: true, name: true, subject: true, status: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.enrollment.findMany({
        where: { email: user.email, status: 'PENDING' },
        include: { course: { select: { id: true, name: true, subject: true, status: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const result: GetStudentCoursesResponse = [
      ...active.map(e => ({
        enrollmentId: e.id,
        enrollmentStatus: 'ACTIVE' as const,
        course: { id: e.course.id, name: e.course.name, subject: e.course.subject, status: e.course.status as CourseStatus },
      })),
      ...pending.map(e => ({
        enrollmentId: e.id,
        enrollmentStatus: 'PENDING' as const,
        course: { id: e.course.id, name: e.course.name, subject: e.course.subject, status: e.course.status as CourseStatus },
      })),
    ]

    res.json(result)
  } catch (err) {
    console.error('[GET /api/student/courses]', err)
    res.status(500).json({ error: 'Failed to fetch courses' })
  }
})

export default router
