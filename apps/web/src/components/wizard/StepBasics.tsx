'use client'

import { Controller, UseFormReturn } from 'react-hook-form'
import type { CourseWizardInput } from '@metis/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const LANGUAGES = ['English', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'German', 'French', 'Spanish']

type Props = {
  form: UseFormReturn<CourseWizardInput>
  onNext: () => void
}

export default function StepBasics({ form, onNext }: Props) {
  const { register, control, formState: { errors } } = form

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Course basics</h2>
        <p className="text-sm text-gray-500 mt-1">Tell us what the course is about.</p>
      </div>

      <div className="space-y-4">
        <Field label="Course name" error={errors.name?.message}>
          <Input {...register('name')} placeholder="e.g. 9th Grade Mathematics" />
        </Field>

        <Field label="Subject" error={errors.subject?.message}>
          <Input {...register('subject')} placeholder="e.g. Mathematics" />
        </Field>

        <Field label="Language" error={errors.language?.message}>
          <Controller
            name="language"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field label="Target audience" error={errors.targetAudience?.message}>
          <Input {...register('targetAudience')} placeholder="e.g. Students aged 14–15" />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext}>Next</Button>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
