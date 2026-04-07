'use client'

import { useState, useCallback } from 'react'
import { StudentExercise, ExerciseResult } from '@metis/types'
import MathMarkdown from '@/components/MathMarkdown'
import VisualizationRenderer from '@/components/visualizations/VisualizationRenderer'

interface Props {
  exercise: StudentExercise
  result?: ExerciseResult
  onSubmit: (exerciseId: number, answer: string | number | Record<string, unknown>) => void
  disabled?: boolean
}

export default function InteractiveExercise({ exercise, result, onSubmit, disabled }: Props) {
  // Track current iframe state so we can submit it on button click
  const [currentState, setCurrentState] = useState<Record<string, unknown>>({})
  const [pending, setPending] = useState(false)

  const submitted = !!result
  const isCorrect = result?.correct ?? false
  const isAlmost  = !isCorrect && (result?.almost ?? false)

  const handleStateChange = useCallback((state: Record<string, unknown>) => {
    setCurrentState(state)
  }, [])

  function handleSubmit() {
    if (submitted || pending || disabled) return
    setPending(true)
    onSubmit(exercise.id, currentState as Record<string, unknown>)
  }

  const cardClass = submitted
    ? 'border border-gray-200'
    : pending
    ? 'border card-evaluating'
    : 'border border-gray-200 shadow-md'

  const pillClass = isCorrect
    ? 'bg-green-100 text-green-700'
    : isAlmost
    ? 'bg-yellow-100 text-yellow-700'
    : 'bg-red-100 text-red-700'

  const resultLabel = !submitted ? '' : isCorrect ? 'Correct' : isAlmost ? 'Not quite' : 'Incorrect'

  return (
    <div className={`rounded-xl bg-white transition-colors overflow-hidden ${cardClass}`}>
      <div className="px-4 py-4">
        <div className="text-sm font-semibold text-gray-900 leading-snug mb-4 prose prose-sm max-w-none">
          <MathMarkdown>{exercise.question}</MathMarkdown>
        </div>

        {/* Template-based visualization (new) */}
        {exercise.visualizationType && (
          <div className="mb-4">
            <VisualizationRenderer
              templateId={exercise.visualizationType}
              params={exercise.visualizationParams}
              onStateChange={handleStateChange}
            />
          </div>
        )}
        {/* Legacy iframe fallback */}
        {!exercise.visualizationType && exercise.visualizationHtml && (
          <div className="mb-4">
            <VisualizationRenderer
              customHtml={exercise.visualizationHtml}
              onStateChange={handleStateChange}
            />
          </div>
        )}

        {!submitted ? (
          <div className="mt-3">
            <button
              onClick={handleSubmit}
              disabled={pending || disabled}
              className="bg-teal-600 text-white text-sm font-bold px-5 py-2 rounded-lg disabled:opacity-40 hover:bg-teal-700 active:bg-teal-800 transition-colors flex items-center gap-2"
            >
              {pending ? (
                <>
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
                    <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Checking…
                </>
              ) : 'Submit'}
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${pillClass}`}>
              {isCorrect ? '✓' : isAlmost ? '≈' : '✗'} {resultLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
