'use client'

import { useState } from 'react'
import { CourseDetail, CourseModule, CourseExercise } from '@metis/types'

const REVIEW_STATUS_STYLES: Record<string, string> = {
  UNREVIEWED: 'bg-gray-200 text-gray-600',
  IN_REVIEW:  'bg-yellow-100 text-yellow-700',
  APPROVED:   'bg-green-100 text-green-700',
}

export default function CourseEditor({ course }: { course: CourseDetail }) {
  const [selectedModuleId, setSelectedModuleId] = useState(course.modules[0]?.id ?? null)
  const selectedModule = course.modules.find(m => m.id === selectedModuleId) ?? null

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Left sidebar */}
      <aside className="w-64 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b">
          <h1 className="font-semibold text-gray-900 truncate">{course.name}</h1>
          <span className="text-xs text-gray-500 uppercase tracking-wide">{course.status}</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {course.modules.map(module => (
            <button
              key={module.id}
              onClick={() => setSelectedModuleId(module.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm mb-1 flex items-center justify-between gap-2 transition-colors ${
                selectedModuleId === module.id
                  ? 'bg-white shadow-sm font-medium text-gray-900'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              <span className="truncate">{module.name}</span>
              <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${REVIEW_STATUS_STYLES[module.reviewStatus]}`}>
                {module.reviewStatus === 'UNREVIEWED' ? 'New' : module.reviewStatus === 'IN_REVIEW' ? 'In review' : 'Approved'}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {selectedModule
          ? <ModuleView module={selectedModule} />
          : <div className="p-8 text-gray-400">No modules found.</div>
        }
      </main>
    </div>
  )
}

function ModuleView({ module }: { module: CourseModule }) {
  // Build a map of conceptId → exercises for this module
  const exercisesByConcept = new Map<number, CourseExercise[]>()
  for (const ex of module.exercises) {
    for (const conceptId of ex.conceptIds) {
      if (!exercisesByConcept.has(conceptId)) exercisesByConcept.set(conceptId, [])
      exercisesByConcept.get(conceptId)!.push(ex)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-10">
      {/* Module overview */}
      <section>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{module.name}</h2>
        {module.whyThisModule && (
          <div className="mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Why this module</span>
            <p className="text-gray-700 mt-1">{module.whyThisModule}</p>
          </div>
        )}
        {module.buildsOn && (
          <div className="mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Builds on</span>
            <p className="text-gray-700 mt-1">{module.buildsOn}</p>
          </div>
        )}
        {module.leadsInto && (
          <div className="mb-3">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Leads into</span>
            <p className="text-gray-700 mt-1">{module.leadsInto}</p>
          </div>
        )}
      </section>

      {/* Concept sections */}
      {module.concepts.map(concept => (
        <section key={concept.id} className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">{concept.name}</h3>

          {/* Theory blocks */}
          <div className="space-y-3">
            {concept.theoryBlocks.map(block => (
              <p key={block.id} className="text-gray-700 leading-relaxed">{block.content}</p>
            ))}
          </div>

          {/* Exercises for this concept */}
          {(exercisesByConcept.get(concept.id) ?? []).map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} />
          ))}
        </section>
      ))}
    </div>
  )
}

function ExerciseCard({ exercise }: { exercise: CourseExercise }) {
  return (
    <div className="border rounded-lg p-4 bg-white space-y-3">
      <div className="flex items-start justify-between gap-4">
        <p className="font-medium text-gray-900">{exercise.question}</p>
        <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
          {exercise.type === 'MULTIPLE_CHOICE' ? 'Multiple choice' : 'Free text'}
        </span>
      </div>

      {exercise.type === 'MULTIPLE_CHOICE' && exercise.options && (
        <ol className="space-y-1 list-none">
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
        <p className="text-sm text-gray-500 italic">{exercise.explanation}</p>
      )}

      {exercise.type === 'FREE_TEXT' && exercise.sampleAnswer && (
        <div className="text-sm space-y-1">
          <span className="font-medium text-gray-500">Sample answer</span>
          <p className="text-gray-700">{exercise.sampleAnswer}</p>
        </div>
      )}

      {exercise.type === 'FREE_TEXT' && exercise.rubric && (
        <div className="text-sm space-y-1">
          <span className="font-medium text-gray-500">Rubric</span>
          <p className="text-gray-700">{exercise.rubric}</p>
        </div>
      )}
    </div>
  )
}
