'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { WizardSchema } from '@/lib/wizardSchema'
import type { CourseWizardInput, CurriculumTemplateFull } from '@metis/types'
import WizardProgress from './WizardProgress'
import StepStart from './StepStart'
import StepTemplate from './StepTemplate'
import StepBasics from './StepBasics'
import StepStructure from './StepStructure'
import StepMaterials from './StepMaterials'
import StepReview from './StepReview'
import { apiFetch } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const STORAGE_KEY = 'course-wizard-draft'

const SCRATCH_STEPS = ['Start', 'Basics', 'Structure', 'Materials', 'Review & Generate'] as const
const TEMPLATE_STEPS = ['Start', 'Template', 'Basics', 'Structure', 'Materials', 'Review & Generate'] as const

type StepName = 'start' | 'template' | 'basics' | 'structure' | 'materials' | 'review'

function getStepName(step: number, useTemplate: boolean | null): StepName {
  if (step === 1) return 'start'
  if (useTemplate) {
    const names: StepName[] = ['start', 'template', 'basics', 'structure', 'materials', 'review']
    return names[step - 1] ?? 'review'
  }
  const names: StepName[] = ['start', 'basics', 'structure', 'materials', 'review']
  return names[step - 1] ?? 'review'
}

function getValidationFields(step: number, useTemplate: boolean | null): (keyof CourseWizardInput)[] {
  if (useTemplate) {
    if (step === 3) return ['name', 'subject', 'language', 'targetAudience']
    if (step === 4) return ['modules']
    return []
  }
  if (step === 2) return ['name', 'subject', 'language', 'targetAudience']
  if (step === 3) return ['modules']
  return []
}

export default function CourseWizard() {
  const [step, setStep] = useState(1)
  const [useTemplate, setUseTemplate] = useState<boolean | null>(null)
  const router = useRouter()

  const form = useForm<CourseWizardInput>({
    resolver: zodResolver(WizardSchema),
    defaultValues: { name: '', subject: '', language: '', targetAudience: '', modules: [], materials: [] },
  })

  // Load saved draft after mount (localStorage is not available during SSR)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) form.reset(JSON.parse(saved))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save on every change
  useEffect(() => {
    const { unsubscribe } = form.watch((values) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
    })
    return unsubscribe
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleStartNext(template: boolean) {
    setUseTemplate(template)
    setStep(2)
  }

  function applyTemplate(template: CurriculumTemplateFull) {
    form.setValue('name', template.name)
    form.setValue('subject', template.subject)
    form.setValue('language', template.language)
    form.setValue('targetAudience', template.targetAudience)
    form.setValue('modules', template.modules.map((m) => ({
      id: crypto.randomUUID(),
      name: m.name,
      objectives: m.objectives.map((o) => ({ id: crypto.randomUUID(), text: o.text })),
      outcomes: m.outcomes.map((o) => ({ id: crypto.randomUUID(), text: o.text, objectiveIds: [] })),
    })))
    setStep(3)
  }

  async function goNext() {
    const fields = getValidationFields(step, useTemplate)
    const valid = fields.length ? await form.trigger(fields) : true
    if (valid) setStep((s) => s + 1)
  }

  function goBack() {
    setStep((s) => s - 1)
  }

  async function onSubmit(data: CourseWizardInput) {
    const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      toast.error('Failed to create course. Please try again.')
      return
    }

    localStorage.removeItem(STORAGE_KEY)
    router.push('/teacher/courses')
  }

  const steps = useTemplate ? TEMPLATE_STEPS : SCRATCH_STEPS
  const currentStepName = getStepName(step, useTemplate)
  const { isSubmitting } = form.formState

  return (
    <div className="max-w-2xl mx-auto">
      <WizardProgress steps={steps} currentStep={step} />
      <div className="mt-10">
        {currentStepName === 'start' && (
          <StepStart onNext={handleStartNext} />
        )}
        {currentStepName === 'template' && (
          <StepTemplate onConfirm={applyTemplate} onBack={goBack} />
        )}
        {currentStepName === 'basics' && (
          <StepBasics form={form} onNext={goNext} onBack={useTemplate ? goBack : undefined} />
        )}
        {currentStepName === 'structure' && (
          <StepStructure form={form} onNext={goNext} onBack={goBack} />
        )}
        {currentStepName === 'materials' && (
          <StepMaterials form={form} onNext={goNext} onBack={goBack} />
        )}
        {currentStepName === 'review' && (
          <StepReview form={form} onBack={goBack} onSubmit={form.handleSubmit(onSubmit)} isSubmitting={isSubmitting} />
        )}
      </div>
    </div>
  )
}
