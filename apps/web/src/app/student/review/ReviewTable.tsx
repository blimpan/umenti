'use client'

import { useState, useMemo } from 'react'
import { ReviewConcept } from '@metis/types'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeDate(isoString: string): string {
  const diffDays = Math.floor((Date.now() - new Date(isoString).getTime()) / 86_400_000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 14) return '1 week ago'
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 60) return '1 month ago'
  return `${Math.floor(diffDays / 30)}mo ago`
}

// Returns Tailwind classes based on how urgent the decay is
function urgencyClasses(score: number): { text: string } {
  if (score >= 70) return { text: 'text-amber-700' }
  if (score >= 40) return { text: 'text-orange-600' }
  return { text: 'text-red-600' }
}

// ─── Filter config ────────────────────────────────────────────────────────────

function getDecayUnitLabel(): string {
  const configuredUnit = process.env.SCORE_DECAY_UNIT?.toLowerCase()
  if (configuredUnit === 'minutes') return 'minute'
  return 'week'
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReviewTable({ concepts }: { concepts: ReviewConcept[] }) {
  const [selectedCourses, setSelectedCourses] = useState<Set<number>>(new Set())
  const decayUnitLabel = getDecayUnitLabel()

  const courses = useMemo(() => {
    const seen = new Map<number, string>()
    for (const c of concepts) seen.set(c.courseId, c.courseName)
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [concepts])

  function toggleCourse(id: number) {
    setSelectedCourses(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = useMemo(() =>
    concepts.filter(c =>
      selectedCourses.size === 0 || selectedCourses.has(c.courseId)
    ),
    [concepts, selectedCourses]
  )

  if (concepts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-16 text-center">
        <p className="text-3xl mb-3">✓</p>
        <p className="font-semibold text-gray-900 mb-1">Nothing due for review</p>
        <p className="text-sm text-gray-400">Keep studying — concepts will appear here as they decay over time.</p>
      </div>
    )
  }

  return (
    <div>
      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
          {courses.map(c => {
            const active = selectedCourses.has(c.id)
            return (
              <button
                key={c.id}
                onClick={() => toggleCourse(c.id)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  active
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {c.name}
              </button>
            )
          })}

          {selectedCourses.size > 0 && (
            <button
              onClick={() => setSelectedCourses(new Set())}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors ml-1"
            >
              Clear
            </button>
          )}

          {selectedCourses.size > 0 && filtered.length !== concepts.length && (
            <span className="text-xs text-gray-400 ml-auto tabular-nums">
              {filtered.length} of {concepts.length} shown
            </span>
          )}
        </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">

        {/* Header row */}
        <div className="grid items-center px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-widest text-gray-400 gap-4"
          style={{ gridTemplateColumns: '1fr 120px 140px 36px' }}>
          <span>Concept</span>
          <span className="text-center">Last studied</span>
          <span className="text-center">Mastery</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            No concepts match these filters.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(concept => {
              const urgency = urgencyClasses(concept.effectiveScore)

              return (
                <div
                  key={concept.conceptId}
                  className="grid items-center px-5 py-4 hover:bg-gray-50 transition-colors gap-4 group"
                  style={{ gridTemplateColumns: '1fr 120px 140px 36px' }}
                >
                  {/* Concept name + breadcrumb */}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{concept.conceptName}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {concept.courseName}
                      <span className="mx-1.5">·</span>
                      {concept.moduleName}
                    </p>
                  </div>

                  {/* Last studied */}
                  <div className="text-center">
                    <span className="text-xs text-gray-400 tabular-nums">{formatRelativeDate(concept.lastActivityAt)}</span>
                  </div>

                  {/* Score */}
                  <div className="text-center">
                    <span className={`text-xs font-semibold tabular-nums ${urgency.text}`}>
                      {Math.round(concept.effectiveScore)}%
                    </span>
                  </div>

                  {/* Go to module (placeholder for future review CTA) */}
                  <div className="flex justify-center">
                    <Link
                      href={`/student/courses/${concept.courseId}/module/${concept.moduleId}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-700 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                      title="Go to module"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer summary */}
      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 mt-4 text-center">
          Scores decay by 10% per {decayUnitLabel} of inactivity — revisit concepts to restore mastery.
        </p>
      )}
    </div>
  )
}
