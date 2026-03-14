import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/auth'

const router = Router()
const prisma = new PrismaClient()

// PATCH /api/content/concepts/:id
router.patch('/concepts/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string)
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return }

  const { name } = req.body as { name: string }
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'name is required' }); return
  }

  try {
    await prisma.concept.update({
      where: { id, course: { teacherId: req.user!.id } },
      data: { name: name.trim() },
    })
    res.status(204).send()
  } catch (err: any) {
    if (err?.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return }
    console.error('[PATCH /api/content/concepts/:id]', err)
    res.status(500).json({ error: 'Failed to update concept' })
  }
})

// PATCH /api/content/theory-blocks/:id
router.patch('/theory-blocks/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string)
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return }

  const { content, pendingRevision } = req.body as { content?: string; pendingRevision?: boolean }
  if (content !== undefined && typeof content !== 'string') {
    res.status(400).json({ error: 'content must be a string' }); return
  }

  try {
    await prisma.theoryBlock.update({
      where: { id, concept: { course: { teacherId: req.user!.id } } },
      data: {
        ...(content !== undefined && { content: content.trim() }),
        ...(pendingRevision !== undefined && { pendingRevision }),
      },
    })
    res.status(204).send()
  } catch (err: any) {
    if (err?.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return }
    console.error('[PATCH /api/content/theory-blocks/:id]', err)
    res.status(500).json({ error: 'Failed to update theory block' })
  }
})

// PATCH /api/content/objectives/:id
router.patch('/objectives/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string)
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return }

  const { text } = req.body as { text: string }
  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'text is required' }); return
  }

  try {
    await prisma.learningObjective.update({
      where: { id, courseModule: { course: { teacherId: req.user!.id } } },
      data: { text: text.trim() },
    })
    res.status(204).send()
  } catch (err: any) {
    if (err?.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return }
    console.error('[PATCH /api/content/objectives/:id]', err)
    res.status(500).json({ error: 'Failed to update objective' })
  }
})

// PATCH /api/content/outcomes/:id
router.patch('/outcomes/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string)
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return }

  const { text } = req.body as { text: string }
  if (typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'text is required' }); return
  }

  try {
    await prisma.learningOutcome.update({
      where: { id, courseModule: { course: { teacherId: req.user!.id } } },
      data: { text: text.trim() },
    })
    res.status(204).send()
  } catch (err: any) {
    if (err?.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return }
    console.error('[PATCH /api/content/outcomes/:id]', err)
    res.status(500).json({ error: 'Failed to update outcome' })
  }
})

// PATCH /api/content/modules/:id
router.patch('/modules/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string)
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return }

  const { name, whyThisModule, buildsOn, leadsInto, reviewStatus } = req.body as {
    name?: string
    whyThisModule?: string
    buildsOn?: string
    leadsInto?: string
    reviewStatus?: 'UNREVIEWED' | 'IN_REVIEW' | 'APPROVED'
  }

  try {
    await prisma.courseModule.update({
      where: { id, course: { teacherId: req.user!.id } },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(whyThisModule !== undefined && { whyThisModule: whyThisModule.trim() }),
        ...(buildsOn !== undefined && { buildsOn: buildsOn.trim() }),
        ...(leadsInto !== undefined && { leadsInto: leadsInto.trim() }),
        ...(reviewStatus !== undefined && { reviewStatus }),
      },
    })
    res.status(204).send()
  } catch (err: any) {
    if (err?.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return }
    console.error('[PATCH /api/content/modules/:id]', err)
    res.status(500).json({ error: 'Failed to update module' })
  }
})

export default router
