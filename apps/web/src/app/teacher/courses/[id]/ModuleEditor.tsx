'use client'

import { useState } from 'react'
import { CourseModule, CourseExercise } from '@metis/types'
import { createClient } from '@/lib/supabase/client'
import InlineEditField from './InlineEditField'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL

async function patch(path: string, body: Record<string, unknown>): Promise<Response> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session!.access_token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) console.error(`PATCH ${path} failed:`, res.status)
  return res
}

interface Props {
  module: CourseModule
  courseId: number
}


export default function ModuleEditor({ module, courseId }: Props) {
  const [infoOpen, setInfoOpen] = useState(true)
  const [openConcepts, setOpenConcepts] = useState<Set<number>>(
    () => new Set(module.concepts.map((c) => c.id))
  )

  const [isApproving, setIsApproving] = useState(false)
  const [approvedOptimistically, setApprovedOptimistically] = useState(module.reviewStatus === 'APPROVED')

  const router = useRouter()

  function toggleConcept(id: number) {
    setOpenConcepts((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Group exercises by conceptId for display alongside each concept
  const exercisesByConcept = new Map<number, CourseExercise[]>()
  for (const ex of module.exercises) {
    for (const conceptId of ex.conceptIds) {
      if (!exercisesByConcept.has(conceptId)) exercisesByConcept.set(conceptId, [])
      exercisesByConcept.get(conceptId)!.push(ex)
    }
  }

  function approveModule() {
    setIsApproving(true)
    const res = patch(`/api/content/modules/${module.id}`, { reviewStatus: 'APPROVED' })
    res.then((r) => {
      setIsApproving(false)

      if (!r.ok) {
        alert('Failed to approve module')
        console.error('Failed to approve module:', r.status, r.statusText)
      } else {
        setApprovedOptimistically(true) // Update UI immediately for better UX
        router.refresh()
      }
    })
    
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-8 space-y-8">
      {/* Module name + approve button */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <InlineEditField
            value={module.name}
            onSave={(v) => patch(`/api/content/modules/${module.id}`, { name: v })}
            className="text-2xl font-semibold text-gray-900"
            placeholder="Module name"
          />
        </div>
        <button
          onClick={approveModule}
          disabled={isApproving || approvedOptimistically}
          className={`shrink-0 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
            approvedOptimistically
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-primary text-white hover:bg-primary/90'
          }`}
        >

          {!isApproving && !approvedOptimistically ? 'Mark as approved' : ''}
          {isApproving && !approvedOptimistically ? 'Approving...' : ''}
          {!isApproving && approvedOptimistically ? '✓ Approved' : ''}

        </button>
      </div>

      {/* Module info (collapsible) */}
      <div className="rounded-xl border border-gray-200">
        <button
          onClick={() => setInfoOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-xl"
        >
          <span>Module info</span>
          <span className="text-gray-400 text-xs">{infoOpen ? '▲' : '▼'}</span>
        </button>

        {infoOpen && (
          <div className="border-t divide-y">
            {[
              { label: 'Why this module', field: 'whyThisModule' as const },
              { label: 'Builds on', field: 'buildsOn' as const },
              { label: 'Leads into', field: 'leadsInto' as const },
            ].map(({ label, field }) => (
              <div key={field} className="px-5 py-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                  {label}
                </p>
                <InlineEditField
                  value={module[field] ?? ''}
                  onSave={(v) => patch(`/api/content/modules/${module.id}`, { [field]: v })}
                  multiline
                  placeholder={`Add ${label.toLowerCase()}...`}
                  className="text-sm text-gray-700"
                />
              </div>
            ))}

            {module.objectives.length > 0 && (
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                  Learning objectives
                </p>
                <ul className="space-y-2">
                  {module.objectives.map((obj) => (
                    <li key={obj.id} className="flex gap-2 items-start">
                      <span className="text-primary mt-0.5 shrink-0 text-sm">•</span>
                      <InlineEditField
                        value={obj.text}
                        onSave={(v) => patch(`/api/content/objectives/${obj.id}`, { text: v })}
                        multiline
                        className="text-sm text-gray-700 flex-1"
                        placeholder="Objective..."
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {module.outcomes.length > 0 && (
              <div className="px-5 py-4">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                  Learning outcomes
                </p>
                <ul className="space-y-2">
                  {module.outcomes.map((out) => (
                    <li key={out.id} className="flex gap-2 items-start">
                      <span className="text-gray-400 mt-0.5 shrink-0 text-sm">–</span>
                      <InlineEditField
                        value={out.text}
                        onSave={(v) => patch(`/api/content/outcomes/${out.id}`, { text: v })}
                        multiline
                        className="text-sm text-gray-700 flex-1"
                        placeholder="Outcome..."
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Concept cards */}
      <div className="space-y-6">
        {module.concepts.map((concept, index) => (
          <div key={concept.id} className="rounded-xl border border-gray-200 overflow-hidden">
            {/* Concept header */}
            <div className="px-5 py-3 bg-gray-50 border-b text-sm font-semibold text-gray-800 flex items-center justify-between gap-2">
              <div className="flex flex-row flex-1 min-w-0">
                <p className="pr-1 whitespace-nowrap">Concept {index + 1}:</p>
                <InlineEditField
                  value={concept.name}
                  onSave={(v) => patch(`/api/content/concepts/${concept.id}`, { name: v })}
                  placeholder="Concept name"
                />
              </div>
              <button
                onClick={() => toggleConcept(concept.id)}
                className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors text-xs"
              >
                {openConcepts.has(concept.id) ? '▲' : '▼'}
              </button>
            </div>

            {openConcepts.has(concept.id) && <div className="divide-y">
              {/* Theory blocks */}
              {concept.theoryBlocks.map((block, index) => (
                <div key={block.id} className="px-5 py-4 group relative">
                  {block.pendingRevision && (
                    <span className="absolute top-3 right-3 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                      Pending revision
                    </span>
                  )}
                  <p className="pr-1 whitespace-nowrap text-sm text-gray-800 font-medium">Theory Block {index+1}</p>
                  <InlineEditField
                    value={block.content}
                    onSave={(v) => patch(`/api/content/theory-blocks/${block.id}`, { content: v })}
                    multiline
                    className="text-sm text-gray-700 leading-relaxed w-full"
                    placeholder="Theory content..."
                  />
                  <div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="text-xs text-gray-400 hover:text-primary transition-colors flex items-center gap-1">
                      ✦ Suggest revision
                    </button>
                  </div>
                </div>
              ))}

              {/* Exercises for this concept */}
              {(exercisesByConcept.get(concept.id) ?? []).map((ex, index) => (
                <div key={ex.id} className="px-5 py-4 group">
                  <p className="pr-1 whitespace-nowrap text-sm text-gray-800 font-medium">Exercise {index+1}</p>
                  <ExerciseCard exercise={ex} />
                </div>
              ))}
            </div>}

            {/* Add exercise */}
            {openConcepts.has(concept.id) && <div className="px-5 py-3 bg-gray-50 border-t">
              <button className="text-xs text-gray-400 hover:text-primary transition-colors">
                + Add exercise
              </button>
            </div>}
          </div>
        ))}

        {module.concepts.length === 0 && (
          <p className="text-gray-400 text-sm">No concepts yet.</p>
        )}
      </div>

      {/* Add concept */}
      <div className="flex justify-center pt-2 pb-12">
        <button className="text-sm text-gray-400 hover:text-primary transition-colors border border-dashed border-gray-200 hover:border-primary rounded-lg px-6 py-3">
          + Add concept
        </button>
      </div>
    </div>
  )
}

function ExerciseCard({ exercise }: { exercise: CourseExercise }) {
  return (
    <div className="px-5 py-4 group">
      <div className="flex items-start justify-between gap-4 mb-3">
        <InlineEditField
          value={exercise.question}
          onSave={(v) => console.log('TODO: save exercise question', exercise.id, v)}
          multiline
          className="text-sm font-medium text-gray-900 flex-1"
          placeholder="Exercise question..."
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
            {exercise.type === 'MULTIPLE_CHOICE' ? 'MC' : 'Free text'}
          </span>
          <button className="text-xs text-gray-400 hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
            ✦ Suggest revision
          </button>
        </div>
      </div>

      {exercise.type === 'MULTIPLE_CHOICE' && exercise.options && (
        <ol className="space-y-1">
          {exercise.options.map((opt, i) => (
            <li
              key={i}
              className={`px-3 py-1.5 rounded text-sm ${
                i === exercise.correctIndex
                  ? 'bg-green-50 text-green-800 font-medium'
                  : 'bg-gray-50 text-gray-700'
              }`}
            >
              {String.fromCharCode(65 + i)}. {opt}
            </li>
          ))}
        </ol>
      )}

      {exercise.type === 'MULTIPLE_CHOICE' && exercise.explanation && (
        <p className="text-xs text-gray-400 mt-2 italic">{exercise.explanation}</p>
      )}

      {exercise.type === 'FREE_TEXT' && exercise.sampleAnswer && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-400">Sample answer</p>
          <p className="text-sm text-gray-700">{exercise.sampleAnswer}</p>
        </div>
      )}

      {exercise.type === 'FREE_TEXT' && exercise.rubric && (
        <div className="space-y-1 mt-2">
          <p className="text-xs font-medium text-gray-400">Rubric</p>
          <p className="text-sm text-gray-700">{exercise.rubric}</p>
        </div>
      )}
    </div>
  )
}
