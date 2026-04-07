import { Router } from 'express'
import prisma from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { logger } from '../lib/logger'
import { invalidateCachedModules } from '../lib/cache'

const router = Router()

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
    prisma.moduleConcept.findMany({ where: { conceptId: id }, select: { moduleId: true } })
      .then(links => invalidateCachedModules(...links.map(l => l.moduleId)))
      .catch(err => logger.error({ err }, 'cache invalidation failed'))
    res.status(204).send()
  } catch (err: any) {
    if (err?.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return }
    logger.error({ err }, '[PATCH /api/content/concepts/:id]')
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
    prisma.moduleConcept.findMany({
      where: { concept: { theoryBlocks: { some: { id } } } },
      select: { moduleId: true },
    }).then(links => invalidateCachedModules(...links.map(l => l.moduleId)))
      .catch(err => logger.error({ err }, 'cache invalidation failed'))
    res.status(204).send()
  } catch (err: any) {
    if (err?.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return }
    logger.error({ err }, '[PATCH /api/content/theory-blocks/:id]')
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
    const updated = await prisma.learningObjective.update({
      where: { id, courseModule: { course: { teacherId: req.user!.id } } },
      data: { text: text.trim() },
      select: { courseModuleId: true },
    })
    invalidateCachedModules(updated.courseModuleId).catch(err => logger.error({ err }, 'cache invalidation failed'))
    res.status(204).send()
  } catch (err: any) {
    if (err?.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return }
    logger.error({ err }, '[PATCH /api/content/objectives/:id]')
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
    const updated = await prisma.learningOutcome.update({
      where: { id, courseModule: { course: { teacherId: req.user!.id } } },
      data: { text: text.trim() },
      select: { courseModuleId: true },
    })
    invalidateCachedModules(updated.courseModuleId).catch(err => logger.error({ err }, 'cache invalidation failed'))
    res.status(204).send()
  } catch (err: any) {
    if (err?.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return }
    logger.error({ err }, '[PATCH /api/content/outcomes/:id]')
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
    invalidateCachedModules(id).catch(err => logger.error({ err }, 'cache invalidation failed'))
    res.status(204).send()
  } catch (err: any) {
    if (err?.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return }
    logger.error({ err }, '[PATCH /api/content/modules/:id]')
    res.status(500).json({ error: 'Failed to update module' })
  }
})

// PATCH /api/content/exercises/:id
router.patch('/exercises/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string)
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid ID' }); return }

  const { question, options, explanation, sampleAnswer, rubric } = req.body as {
    question?:     string
    options?:      string[]
    explanation?:  string
    sampleAnswer?: string
    rubric?:       string
  }

  try {
    const updated = await prisma.exercise.update({
      where: { id, courseModule: { course: { teacherId: req.user!.id } } },
      data: {
        ...(question     !== undefined && { question:     question.trim() }),
        ...(options      !== undefined && { options }),
        ...(explanation  !== undefined && { explanation:  explanation.trim() }),
        ...(sampleAnswer !== undefined && { sampleAnswer: sampleAnswer.trim() }),
        ...(rubric       !== undefined && { rubric:       rubric.trim() }),
      },
      select: { courseModuleId: true },
    })
    invalidateCachedModules(updated.courseModuleId).catch(err => logger.error({ err }, 'cache invalidation failed'))
    res.status(204).send()
  } catch (err: any) {
    if (err?.code === 'P2025') { res.status(404).json({ error: 'Not found' }); return }
    logger.error({ err }, '[PATCH /api/content/exercises/:id]')
    res.status(500).json({ error: 'Failed to update exercise' })
  }
})

export default router
