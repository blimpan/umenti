'use client'

import { useState } from 'react'
import { StudentExercise, ExerciseResult } from '@metis/types'
import MathMarkdown from '@/components/MathMarkdown'

interface Props {
  exercise: StudentExercise
  result?: ExerciseResult
  onSubmit: (exerciseId: number, answer: string | number | Record<string, unknown>) => void
  disabled?: boolean
}

export default function MultipleChoiceExercise({ exercise, result, onSubmit, disabled }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [pending,       setPending]       = useState(false)

  const submitted = !!result
  const isCorrect = result?.correct ?? false

  // Two-step: student selects → sees selection highlighted → presses Check → submits
  function handleSelect(index: number) {
    if (submitted || pending || disabled) return
    setSelectedIndex(index)
  }

  function handleCheck() {
    if (selectedIndex === null || submitted || pending || disabled) return
    setPending(true)
    onSubmit(exercise.id, selectedIndex)
  }

  // ── Card border / background driven by state ────────────────────────────
  const cardClass = submitted
    ? 'border border-gray-200'
    : pending
    ? 'border card-evaluating'
    : 'border border-gray-200 shadow-md'

  return (
    <div className={`rounded-xl bg-white transition-colors overflow-hidden ${cardClass}`}>
      {/* Body */}
      <div className="px-4 py-4">
        <div className="text-sm font-semibold text-gray-900 leading-snug mb-4 prose prose-sm max-w-none">
          <MathMarkdown>{exercise.question}</MathMarkdown>
        </div>

        <div className="space-y-2">
          {exercise.options?.map((option, index) => {
            const isSelected = index === selectedIndex

            // After submission: green = correct selected, amber = wrong selected, gray = unselected
            const optionClass = submitted
              ? isSelected && isCorrect
                ? 'border-green-400 text-gray-900'
                : isSelected && !isCorrect
                ? 'border-red-400 text-gray-900'
                : 'border-gray-100 text-gray-400'
              : isSelected
              ? 'border-teal-500 bg-teal-50 text-teal-900'
              : pending
              ? 'border-gray-100 text-gray-300 opacity-50'
              : 'border-gray-200 hover:border-gray-400 text-gray-800 hover:bg-gray-50'

            // Radio dot inside each option
            const radioClass = submitted
              ? isSelected && isCorrect
                ? 'border-green-500 bg-green-500'
                : isSelected && !isCorrect
                ? 'border-red-500 bg-red-500'
                : 'border-gray-200'
              : isSelected
              ? 'border-teal-500 bg-teal-500'
              : 'border-gray-300'

            return (
              <button
                key={index}
                onClick={() => handleSelect(index)}
                disabled={submitted || pending || disabled}
                className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border min-h-[44px] text-sm transition-colors disabled:cursor-default ${optionClass}`}
              >
                <span className={`w-4 h-4 rounded-full border-2 shrink-0 transition-colors ${radioClass}`} />
                <span className="prose prose-sm max-w-none"><MathMarkdown>{option}</MathMarkdown></span>
              </button>
            )
          })}
        </div>

        {/* Check button — shown while a selection is made and not yet submitted */}
        {!submitted && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={handleCheck}
              disabled={selectedIndex === null || pending || disabled}
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
              ) : 'Check'}
            </button>
          </div>
        )}

        {/* Result feedback */}
        {submitted && result && (
          <div className="mt-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
              isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {isCorrect ? '✓ Correct' : '↗ Not quite'}
            </span>
            {result.feedback && (
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">{result.feedback}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
