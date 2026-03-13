'use client'

import { UseFormReturn } from 'react-hook-form'
import type { CourseWizardInput } from '@metis/types'
import { Button } from '@/components/ui/button'

type Props = {
  form: UseFormReturn<CourseWizardInput>
  onBack: () => void
  onSubmit: () => void
}

export default function StepReview({ form, onBack, onSubmit }: Props) {
  const { getValues } = form
  const data = getValues()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review & generate</h2>
        <p className="text-sm text-gray-500 mt-1">
          Check everything looks right before the AI builds your course.
        </p>
      </div>

      {/* Basics summary */}
      <section className="space-y-1">
        <h3 className="text-sm font-semibold text-gray-700">Basics</h3>
        <div className="text-sm text-gray-600 space-y-0.5">
          <p><span className="text-gray-400">Name</span> {data.name}</p>
          <p><span className="text-gray-400">Subject</span> {data.subject}</p>
          <p><span className="text-gray-400">Language</span> {data.language}</p>
          <p><span className="text-gray-400">Audience</span> {data.targetAudience}</p>
        </div>
      </section>

      {/* Structure summary */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Structure</h3>
        {data.modules.map((m, i) => (
          <div key={m.id} className="text-sm text-gray-600">
            <p className="font-medium">{i + 1}. {m.name}</p>
            <p className="text-gray-400 text-xs ml-3">
              {m.objectives.length} objective{m.objectives.length !== 1 ? 's' : ''} ·{' '}
              {m.outcomes.length} outcome{m.outcomes.length !== 1 ? 's' : ''}
            </p>
          </div>
        ))}
      </section>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onSubmit}>Generate course</Button>
      </div>
    </div>
  )
}
