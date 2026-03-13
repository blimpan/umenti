'use client'

import { useState } from 'react'
import { Control, FieldErrors, UseFormRegister, useFieldArray } from 'react-hook-form'
import type { CourseWizardInput } from '@metis/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Props = {
  nestIndex: number
  control: Control<CourseWizardInput>
  register: UseFormRegister<CourseWizardInput>
  errors: FieldErrors<CourseWizardInput>
  onRemove: () => void
}

export default function ModuleItem({ nestIndex, control, register, errors, onRemove }: Props) {
  const [expanded, setExpanded] = useState(true)

  const { fields: objectives, append: appendObjective, remove: removeObjective } = useFieldArray({
    control,
    name: `modules.${nestIndex}.objectives`,
  })

  const { fields: outcomes, append: appendOutcome, remove: removeOutcome } = useFieldArray({
    control,
    name: `modules.${nestIndex}.outcomes`,
  })

  const moduleErrors = errors.modules?.[nestIndex]

  return (
    <div className="border border-gray-200 rounded-lg">
      {/* Module header */}
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-gray-400 hover:text-gray-600 transition-colors text-sm w-4"
        >
          {expanded ? '▾' : '▸'}
        </button>
        <Input
          {...register(`modules.${nestIndex}.name`)}
          placeholder="Module name, e.g. Market Equilibrium"
          className="flex-1"
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-300 hover:text-red-400 transition-colors text-sm"
        >
          ✕
        </button>
      </div>

      {/* Module error */}
      {moduleErrors?.name && (
        <p className="px-4 pb-2 text-xs text-red-500">{moduleErrors.name.message}</p>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-5 border-t border-gray-100 pt-4">
          {/* Objectives */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Learning objectives</p>
            <p className="text-xs text-gray-400">What is the goal of this module?</p>
            {objectives.map((obj, i) => (
              <div key={obj.id} className="flex items-center gap-2">
                <Input
                  {...register(`modules.${nestIndex}.objectives.${i}.text`)}
                  placeholder="e.g. Understanding market equilibrium"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeObjective(i)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
            {moduleErrors?.objectives && (
              <p className="text-xs text-red-500">
                {typeof moduleErrors.objectives.message === 'string'
                  ? moduleErrors.objectives.message
                  : 'Define at least one learning objective. It can not be empty.'}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendObjective({ id: crypto.randomUUID(), text: '' })}
            >
              + Add objective
            </Button>
          </div>

          {/* Outcomes */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Learning outcomes</p>
            <p className="text-xs text-gray-400">How will mastery be measured?</p>
            {outcomes.map((outcome, i) => (
              <div key={outcome.id} className="flex items-center gap-2">
                <Input
                  {...register(`modules.${nestIndex}.outcomes.${i}.text`)}
                  placeholder="e.g. Student can calculate the equilibrium price on a graph"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeOutcome(i)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
            {moduleErrors?.outcomes && (
              <p className="text-xs text-red-500">
                {typeof moduleErrors.outcomes.message === 'string'
                  ? moduleErrors.outcomes.message
                  : 'Fix outcome errors above'}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendOutcome({ id: crypto.randomUUID(), text: '', objectiveIds: [] })}
            >
              + Add outcome
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
