'use client'

import { StudentExercise, ExerciseResult } from '@metis/types'
import MultipleChoiceExercise from './MultipleChoiceExercise'
import FreeTextExercise from './FreeTextExercise'
import InteractiveExercise from './InteractiveExercise'

interface Props {
  exercise: StudentExercise
  result?: ExerciseResult
  onSubmit: (exerciseId: number, answer: string | number | Record<string, unknown>) => void
  disabled?: boolean
}

export default function ExerciseCard({ exercise, result, onSubmit, disabled }: Props) {
  if (exercise.type === 'MULTIPLE_CHOICE')
    return <MultipleChoiceExercise exercise={exercise} result={result} onSubmit={onSubmit} disabled={disabled} />
  if (exercise.type === 'FREE_TEXT')
    return <FreeTextExercise exercise={exercise} result={result} onSubmit={onSubmit} disabled={disabled} />
  if (exercise.type === 'INTERACTIVE')
    return <InteractiveExercise exercise={exercise} result={result} onSubmit={onSubmit} disabled={disabled} />
  return null
}
