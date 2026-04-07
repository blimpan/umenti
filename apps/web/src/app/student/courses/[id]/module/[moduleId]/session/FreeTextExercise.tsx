'use client'

import { useEffect, useMemo, useState } from 'react'
import { StudentExercise, ExerciseResult } from '@metis/types'
import type { RichMessage } from '@metis/types'
import MathMarkdown from '@/components/MathMarkdown'
import { RichInput } from '@/components/input/RichInput'
import { RichMessageRenderer } from '@/components/input/RichMessageRenderer'
import { richContentToText } from '@/lib/richContent'

interface Props {
  exercise: StudentExercise
  result?: ExerciseResult
  onSubmit: (exerciseId: number, answer: string | number | Record<string, unknown>) => void
  disabled?: boolean
}

export default function FreeTextExercise({ exercise, result, onSubmit, disabled }: Props) {
  const [pending, setPending] = useState(false)
  const [submittedMessage, setSubmittedMessage] = useState<RichMessage | null>(null)
  // Triggers the shake animation once when an incorrect result arrives
  const [shaking, setShaking] = useState(false)

  const submitted = !!result
  const isCorrect = result?.correct ?? false
  const isAlmost  = !isCorrect && (result?.almost ?? false)

  // Clear pending and trigger shake animation when a result arrives
  useEffect(() => {
    if (submitted) {
      setPending(false)
      if (!isCorrect) {
        setShaking(true)
        const t = setTimeout(() => setShaking(false), 350)
        return () => clearTimeout(t)
      }
    }
  }, [submitted, isCorrect])

  const resultLabel = useMemo(() => {
    if (!submitted) return ''
    if (isCorrect) return 'Correct'
    if (isAlmost)  return 'Not quite'
    return 'Incorrect'
  }, [submitted, isCorrect, isAlmost])

  function handleSubmit(message: RichMessage) {
    if (submitted || pending || disabled) return
    setSubmittedMessage(message)
    setPending(true)
    // Build an answer string that includes LaTeX from math chips so the
    // backend grader sees the actual mathematical expression, not empty text.
    const answer = message.plainText
    onSubmit(exercise.id, answer)
  }

  // ── Card border / background driven by state ────────────────────────────
  const cardClass = submitted
    ? 'border border-gray-200'
    : pending
    ? 'border card-evaluating'
    : 'border border-gray-200 shadow-md'

  // ── Result label pill ───────────────────────────────────────────────────
  const pillClass = isCorrect
    ? 'bg-green-100 text-green-700'
    : isAlmost
    ? 'bg-yellow-100 text-yellow-700'
    : 'bg-red-100 text-red-700'

  return (
    <div className={`rounded-xl bg-white transition-colors overflow-hidden ${cardClass} ${shaking ? 'card-shake' : ''}`}>
      {/* Body */}
      <div className="px-4 py-4">
        <div className="text-sm font-semibold text-gray-900 leading-snug mb-4 prose prose-sm max-w-none">
          <MathMarkdown>{exercise.question}</MathMarkdown>
        </div>

        {!submitted ? (
          <div className="mt-3">
            <RichInput
              onSubmit={handleSubmit}
              allowImages={false}
              disabled={pending || !!disabled}
              placeholder="Write your answer…"
            />
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {submittedMessage && (
              <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                <RichMessageRenderer richContent={submittedMessage.richContent} />
              </div>
            )}
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${pillClass}`}>
              {isCorrect ? '✓' : isAlmost ? '≈' : '✗'} {resultLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
