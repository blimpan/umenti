'use client'

import { Controller, UseFormReturn } from 'react-hook-form'
import type { CourseWizardInput } from '@metis/types'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import SuggestedInput from './SuggestedInput'

const LANGUAGES = ['English', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'German', 'French', 'Spanish']

type Props = {
  form: UseFormReturn<CourseWizardInput>
  onNext: () => void
}

export default function StepBasics({ form, onNext }: Props) {
  const { register, control, formState: { errors }, watch, setValue } = form
  const name = watch('name')
  const subject = watch('subject')
  const language = watch('language')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Course basics</h2>
        <p className="text-sm text-gray-500 mt-1">Tell us what the course is about.</p>
      </div>

      <div className="space-y-4">
        <Field label="Course name" error={errors.name?.message}>
          <SuggestedInput
            {...register('name')}
            field="name"
            context={{ language }}
            placeholder="e.g. 9th Grade Mathematics"
            onAccept={(val) => setValue('name', val, { shouldValidate: true })}
          />
        </Field>

        <Field label="Subject" error={errors.subject?.message}>
          <SuggestedInput
            {...register('subject')}
            field="subject"
            context={{ name }}
            placeholder="e.g. Mathematics"
            onAccept={(val) => setValue('subject', val, { shouldValidate: true })}
          />
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
          <SuggestedInput
            {...register('targetAudience')}
            field="targetAudience"
            context={{ name, subject, language }}
            placeholder="e.g. Students aged 14-15"
            onAccept={(val) => setValue('targetAudience', val, { shouldValidate: true })}
          />
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
