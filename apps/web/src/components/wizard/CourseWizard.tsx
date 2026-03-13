'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { WizardSchema } from '@/lib/wizardSchema'
import type { CourseWizardInput } from '@metis/types'
import WizardProgress from './WizardProgress'
import StepBasics from './StepBasics'
import StepStructure from './StepStructure'
import StepMaterials from './StepMaterials'
import StepReview from './StepReview'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'course-wizard-draft'

const STEPS = ['Basics', 'Structure', 'Materials', 'Review & Generate'] as const

const STEP_FIELDS: Record<number, (keyof CourseWizardInput)[]> = {
  1: ['name', 'subject', 'language', 'targetAudience'],
  2: ['modules'],
  3: [],
}

export default function CourseWizard() {
  const [step, setStep] = useState(1)
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

  async function goNext() {
    const fields = STEP_FIELDS[step]
    const valid = fields?.length ? await form.trigger(fields) : true
    if (valid) setStep((s) => s + 1)
  }

  function goBack() {
    setStep((s) => s - 1)
  }

  async function onSubmit(data: CourseWizardInput) {
    const { data: { session } } = await createClient().auth.getSession()

    console.log('Submitting course data', data)

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session!.access_token}`
      },
      body: JSON.stringify(data)
    })

    if (!res.ok) {
      console.error('Failed to create course', await res.text())
      alert('Failed to create course. Please try again later.')
      return
    }

    localStorage.removeItem(STORAGE_KEY)
    router.push('/teacher/courses')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <WizardProgress steps={STEPS} currentStep={step} />
      <div className="mt-10">
        {step === 1 && <StepBasics form={form} onNext={goNext} />}
        {step === 2 && <StepStructure form={form} onNext={goNext} onBack={goBack} />}
        {step === 3 && <StepMaterials form={form} onNext={goNext} onBack={goBack} />}
        {step === 4 && <StepReview form={form} onBack={goBack} onSubmit={form.handleSubmit(onSubmit)} />}
      </div>
    </div>
  )
}
