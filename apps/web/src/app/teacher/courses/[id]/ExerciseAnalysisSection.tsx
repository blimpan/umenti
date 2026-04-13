'use client'

import { useEffect, useState } from 'react'
import { ExerciseAnalysisSummary, GetExerciseAnalyticsResponse, TriggerAnalysisResponse } from '@metis/types'
import { apiFetch } from '@/lib/api'
import MathMarkdown from '@/components/MathMarkdown'

const API = process.env.NEXT_PUBLIC_API_URL

interface Props {
  courseId: number
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-primary"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}

interface ExerciseRowProps {
  exercise: ExerciseAnalysisSummary
  courseId: number
  onAnalysisUpdate: (exerciseId: number, result: TriggerAnalysisResponse['analysis']) => void
}

function ExerciseRow({ exercise, courseId, onAnalysisUpdate }: ExerciseRowProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  async function triggerAnalysis() {
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const res = await apiFetch(
        `${API}/api/courses/${courseId}/analytics/exercises/${exercise.exerciseId}/analyze`,
        { method: 'POST' }
      )
      if (res.ok) {
        const data: TriggerAnalysisResponse = await res.json()
        onAnalysisUpdate(exercise.exerciseId, data.analysis)
        setExpanded(true)
      } else if (res.status === 422) {
        setAnalyzeError('No student answers yet — analysis will be available once students submit responses.')
      } else {
        setAnalyzeError('Analysis failed. Try again.')
      }
    } catch {
      setAnalyzeError('Analysis failed. Try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  const hasAnalysis = exercise.analysis !== null

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <MathMarkdown className="text-sm text-gray-800 font-medium line-clamp-2 [&_p]:m-0">{exercise.question}</MathMarkdown>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                {exercise.type.replace('_', ' ').toLowerCase()}
              </span>
              {hasAnalysis && (
                <span className="text-xs text-gray-400">
                  Analyzed {new Date(exercise.analysis!.generatedAt).toLocaleDateString('en', {
                    month: 'short', day: 'numeric',
                  })} · {exercise.analysis!.attemptCountAtGeneration} attempts
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-2">
              {hasAnalysis && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {expanded ? 'Hide' : 'View'}
                </button>
              )}
              <button
                onClick={triggerAnalysis}
                disabled={analyzing}
                className="flex items-center gap-1.5 text-xs font-medium bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {analyzing ? (
                  <>
                    <Spinner />
                    Analyzing…
                  </>
                ) : hasAnalysis ? (
                  'Regenerate'
                ) : (
                  'Generate analysis'
                )}
              </button>
            </div>
            {analyzeError && (
              <p className="text-xs text-red-500">{analyzeError}</p>
            )}
          </div>
        </div>

        {expanded && hasAnalysis && (
          <div className="mt-3 bg-gray-50 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Summary</p>
            <MathMarkdown className="text-sm text-gray-700 [&_p]:m-0">{exercise.analysis!.summary}</MathMarkdown>

            {exercise.analysis!.commonMisconceptions.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">
                  Common misconceptions
                </p>
                <ul className="space-y-1">
                  {exercise.analysis!.commonMisconceptions.map((m, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-gray-400 shrink-0">·</span>
                      <MathMarkdown className="min-w-0 flex-1 [&_p]:m-0">{m}</MathMarkdown>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExerciseAnalysisSection({ courseId }: Props) {
  const [exercises, setExercises] = useState<ExerciseAnalysisSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const res = await apiFetch(`${API}/api/courses/${courseId}/analytics/exercises`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('Failed to load exercises')
        const data: GetExerciseAnalyticsResponse = await res.json()
        setExercises(data.exercises)
        setLoading(false)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError('Could not load exercise data. Please try again.')
        setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [courseId])

  function handleAnalysisUpdate(
    exerciseId: number,
    analysis: TriggerAnalysisResponse['analysis']
  ) {
    setExercises(prev =>
      prev.map(ex =>
        ex.exerciseId === exerciseId ? { ...ex, analysis } : ex
      )
    )
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>
  }

  if (exercises.length === 0) {
    return (
      <p className="text-sm text-gray-400">No exercises found in this course.</p>
    )
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {exercises.map(exercise => (
        <ExerciseRow
          key={exercise.exerciseId}
          exercise={exercise}
          courseId={courseId}
          onAnalysisUpdate={handleAnalysisUpdate}
        />
      ))}
    </div>
  )
}
