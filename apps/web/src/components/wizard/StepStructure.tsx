'use client'

import { UseFormReturn, useFieldArray } from 'react-hook-form'
import type { CourseWizardInput } from '@metis/types'
import { Button } from '@/components/ui/button'
import ModuleItem from './ModuleItem'

type Props = {
  form: UseFormReturn<CourseWizardInput>
  onNext: () => void
  onBack: () => void
}

export default function StepStructure({ form, onNext, onBack }: Props) {
  const { control, register, formState: { errors } } = form

  const { fields: modules, append, remove } = useFieldArray({
    control,
    name: 'modules',
  })

  function handleAddModule() {
    append({
      id: crypto.randomUUID(),
      name: '',
      objectives: [],
      outcomes: [],
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Course structure</h2>
        <p className="text-sm text-gray-500 mt-1">
          Define your modules and what students should learn in each one.
          The AI will infer the specific concepts to cover.
        </p>
      </div>

      <div className="space-y-3">
        {modules.map((module, i) => (
          <ModuleItem
            key={module.id}
            nestIndex={i}
            control={control}
            register={register}
            errors={errors}
            onRemove={() => remove(i)}
          />
        ))}
      </div>

      {errors.modules && typeof errors.modules.message === 'string' && (
        <p className="text-xs text-red-500">{errors.modules.message}</p>
      )}

      <Button type="button" variant="outline" onClick={handleAddModule} className="w-full">
        + Add module
      </Button>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Next</Button>
      </div>
    </div>
  )
}
