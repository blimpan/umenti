'use client'

import { UseFormReturn } from 'react-hook-form'
import type { CourseWizardInput } from '@metis/types'
import { Button } from '@/components/ui/button'

type Props = {
  form: UseFormReturn<CourseWizardInput>
  onNext: () => void
  onBack: () => void
}

export default function StepMaterials({ form, onNext, onBack }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Upload materials</h2>
        <p className="text-sm text-gray-500 mt-1">
          Optionally upload existing material for the AI to ground itself in.
          If skipped, the AI generates all theory from scratch.
        </p>
      </div>

      {/* TODO: file upload UI */}
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center text-sm text-gray-400">
        File upload coming soon
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onNext}>Skip</Button>
          <Button onClick={onNext}>Next</Button>
        </div>
      </div>
    </div>
  )
}
