import { Router } from 'express'
import prisma from '../lib/prisma'
import { logger } from '../lib/logger'
import { requireAuth } from '../middleware/auth'
import type { GetTemplatesMetaResponse, CurriculumTemplateFull } from '@metis/types'

const router = Router()

// GET /api/templates/meta — lightweight cascade data for dropdowns
router.get('/meta', requireAuth, async (_req, res) => {
  try {
    const templates = await prisma.curriculumTemplate.findMany({
      orderBy: [{ country: 'asc' }, { subject: 'asc' }, { name: 'asc' }],
      select: { id: true, country: true, subject: true, grade: true, name: true },
    })
    const meta = buildMetaResponse(templates)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.json(meta)
  } catch (err) {
    logger.error({ err }, '[GET /api/templates/meta]')
    res.status(500).json({ error: 'Failed to fetch template metadata' })
  }
})

// GET /api/templates/:id — full template with modules, objectives, outcomes
router.get('/:id', requireAuth, async (req, res) => {
  const id = parseInt(req.params.id as string)
  if (isNaN(id)) { res.status(400).json({ error: 'Invalid template ID' }); return }

  try {
    const template = await prisma.curriculumTemplate.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { order: 'asc' },
          include: { objectives: true, outcomes: true },
        },
      },
    })

    if (!template) { res.status(404).json({ error: 'Template not found' }); return }

    const response: CurriculumTemplateFull = {
      id: template.id,
      country: template.country,
      subject: template.subject,
      grade: template.grade,
      name: template.name,
      language: template.language,
      targetAudience: template.targetAudience,
      modules: template.modules.map(m => ({
        name: m.name,
        order: m.order,
        objectives: m.objectives.map(o => ({ text: o.text })),
        outcomes: m.outcomes.map(o => ({ text: o.text })),
      })),
    }

    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.json(response)
  } catch (err) {
    logger.error({ err }, '[GET /api/templates/:id]')
    res.status(500).json({ error: 'Failed to fetch template' })
  }
})

export function buildMetaResponse(
  templates: { id: number; country: string; subject: string; grade: string; name: string }[]
): GetTemplatesMetaResponse {
  const countryMap = new Map<string, Map<string, { id: number; name: string; grade: string }[]>>()

  for (const t of templates) {
    if (!countryMap.has(t.country)) countryMap.set(t.country, new Map())
    const subjectMap = countryMap.get(t.country)!
    if (!subjectMap.has(t.subject)) subjectMap.set(t.subject, [])
    subjectMap.get(t.subject)!.push({ id: t.id, name: t.name, grade: t.grade })
  }

  return Array.from(countryMap.entries()).map(([country, subjectMap]) => ({
    country,
    subjects: Array.from(subjectMap.entries()).map(([subject, templates]) => ({
      subject,
      templates,
    })),
  }))
}

export default router
