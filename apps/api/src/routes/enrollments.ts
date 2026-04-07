import { Router } from 'express'
import prisma from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { logger } from '../lib/logger'

const router = Router()

// PATCH /api/enrollments/:id — student accepts or rejects a course invitation
router.patch('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string)
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return }

  const { status } = req.body as { status: string }
  if (status !== 'ACTIVE' && status !== 'REJECTED') {
    res.status(400).json({ error: 'status must be ACTIVE or REJECTED' }); return
  }

  try {

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        id,
      },
      select: {
        email: true,
        status: true,
        courseId: true,
      },
    })

    if (!enrollment || enrollment.status !== 'PENDING') {
      res.status(404).json({ error: 'Enrollment not found or not pending' }); return
    }

    const user = await prisma.user.findUnique({
      where: {
        supabaseId: req.user!.id,
      },
      select: {
        email: true,
      },
    })

    if (user?.email !== enrollment.email) {
      res.status(403).json({ error: 'Forbidden' }); return
    }

    await prisma.enrollment.update({
      where: {
        id,
      },
      data: {
        status,
        userId: status === 'ACTIVE' ? req.user!.id : null,
      }
    })

    res.status(204).send()
      } catch (err) {
    logger.error({ err }, '[PATCH /api/enrollments/:id]')
    res.status(500).json({ error: 'Failed to update enrollment' })
  }
})

// DELETE /api/enrollments/:id — teacher withdraws a pending invitation
router.delete('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string)
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return }

  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: { id },
      select: { status: true, course: { select: { teacherId: true } } },
    })

    if (!enrollment || enrollment.status !== 'PENDING') {
      res.status(404).json({ error: 'Enrollment not found or not pending' }); return
    }

    if (enrollment.course.teacherId !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' }); return
    }

    await prisma.enrollment.delete({ where: { id } })
    res.status(204).send()
  } catch (err) {
    logger.error({ err }, '[DELETE /api/enrollments/:id]')
    res.status(500).json({ error: 'Failed to withdraw enrollment' })
  }
})

export default router
