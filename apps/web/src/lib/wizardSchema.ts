import { z } from 'zod'
import type { CourseWizardInput } from '@metis/types'

export const ObjectiveSchema = z.object({
  id: z.string(),
  text: z.string().min(1, 'Objective cannot be empty'),
})

export const OutcomeSchema = z.object({
  id: z.string(),
  text: z.string().min(1, 'Outcome cannot be empty'),
  objectiveIds: z.array(z.string()),
})

export const ModuleSchema = z.object({
  id: z.string().min(1, 'Module ID is required'),
  name: z.string().min(1, 'Module name is required'),
  objectives: z.array(ObjectiveSchema).min(1, 'Add at least one objective'),
  outcomes: z.array(OutcomeSchema).min(1, 'Add at least one outcome'),
})

// `satisfies` checks that WizardSchema's output matches CourseWizardInput at compile
// time, without widening the type — so zodResolver keeps the concrete shape it needs.
export const WizardSchema = z.object({
  name: z.string().min(1, 'Course name is required'),
  subject: z.string().min(1, 'Subject is required'),
  language: z.string().min(1, 'Language is required'),
  targetAudience: z.string().min(1, 'Target audience is required'),
  modules: z.array(ModuleSchema).min(1, 'Add at least one module'),
  materials: z.array(z.object({
    type: z.enum(['file', 'link']),
    filename: z.string().optional(),
    storageKey: z.string().optional(),
    title: z.string().optional(),
    url: z.string().optional(),
    moduleIds: z.array(z.string()),
  })).default([]),
}) satisfies z.ZodType<CourseWizardInput>

