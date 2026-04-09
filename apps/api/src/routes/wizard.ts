import { Router } from 'express'
import { generateText } from 'ai'
import { requireAuth } from '../middleware/auth'
import { getModel } from '../lib/llm'
import { llmLogger } from '../lib/logger'
import type { WizardSuggestContext, WizardSuggestRequest, WizardSuggestResponse } from '@metis/types'

const router = Router()

router.post('/suggest', requireAuth, async (req, res) => {
  const { field, context } = req.body as WizardSuggestRequest

  const prompt = buildPrompt(field, context)
  if (!prompt) {
    res.status(400).json({ error: `Unknown field: ${field}` })
    return
  }

  try {
    const { text } = await generateText({ model: getModel(), prompt })
    // Trim whitespace and strip surrounding quotes the LLM sometimes adds
    const suggestion = text.trim().replace(/^["']|["']$/g, '')
    const response: WizardSuggestResponse = { suggestion }
    res.json(response)
  } catch (err) {
    llmLogger.error({ err }, '[POST /wizard/suggest]')
    res.status(500).json({ error: 'Failed to generate suggestion' })
  }
})

export function buildPrompt(field: string, context: WizardSuggestContext): string | null {
  const lang = context.language ? ` Reply in ${context.language}.` : ''

  switch (field) {
    case 'name':
      return `Suggest a concise, descriptive course name${context.language ? ` taught in ${context.language}` : ''}. The name should be suitable for an academic setting. Reply with only the course name, nothing else.${lang}`

    case 'subject':
      return `Suggest a subject area for a course called "${context.name}". Reply with only the subject name, nothing else.${lang}`

    case 'targetAudience':
      return `Suggest a brief target audience description for a ${context.subject} course called "${context.name}"${context.language ? ` taught in ${context.language}` : ''}. Example format: "Students aged 14-15". Reply with only the description, nothing else.${lang}`

    case 'module.name': {
      const existingList = context.existingModuleNames?.filter(Boolean).join(', ')
      return `Suggest a module name for a ${context.subject} course called "${context.name}" targeting ${context.targetAudience}${existingList ? `. Existing modules: ${existingList}. Suggest something that does not overlap with these` : ''}. If no clear style can be inferred from the provided context, default to using an academic style. Reply with only the module name, nothing else.${lang}`
    }

    case 'module.objective': {
      const existingObjectives = context.existingObjectives?.filter(Boolean).join('; ')
      return `Suggest one learning objective for a module called "${context.moduleName}" in a ${context.subject} course called "${context.name}". A learning objective states what students should be able to do.${existingObjectives ? ` Objectives already defined for this module: ${existingObjectives}. Suggest something distinct — do not repeat or rephrase any of these.` : ''} If no clear style can be inferred from the provided context, default to using an academic style. Keep it atomic as there may be multiple objectives for a single module. Reply with only the objective, nothing else. Respond only in ${lang}`
    }

    case 'module.outcome': {
      const objectives = context.existingObjectives?.filter(Boolean).join('; ')
      const existingOutcomes = context.existingOutcomes?.filter(Boolean).join('; ')
      return `Suggest one learning outcome for a module called "${context.moduleName}" in a ${context.subject} course.${objectives ? ` Learning objectives for this module: ${objectives}.` : ''}${existingOutcomes ? ` Outcomes already defined for this module: ${existingOutcomes}. Suggest something distinct — do not repeat or rephrase any of these.` : ''} A learning outcome is measurable evidence of mastery. If no clear style can be inferred from the provided context, default to using an academic style. Keep it atomic as there may be multiple outcomes for a single module. Do NOT include any specific measurement goal (e.g. student can solve X 90% of the time) because this will be tracked separately. Reply with only the outcome, nothing else. Respond only in ${lang}`
    }

    default:
      return null
  }
}

export default router
