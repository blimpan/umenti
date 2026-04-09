'use client'

import { ConceptBreakdownItem } from '@metis/types'

interface Props {
  concepts: ConceptBreakdownItem[]
}

export default function ConceptBreakdownSection({ concepts }: Props) {
  if (concepts.length === 0) {
    return (
      <p className="text-sm text-gray-400">No concept data yet — students haven&apos;t attempted any exercises.</p>
    )
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1fr_160px_100px_100px] bg-gray-50 border-b border-gray-200 px-4 py-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Concept</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Avg score</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Attempts</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Students</span>
      </div>

      {concepts.map((concept, i) => (
        <div
          key={concept.conceptId}
          className={`grid grid-cols-[1fr_160px_100px_100px] px-4 py-3 items-center text-sm ${
            i < concepts.length - 1 ? 'border-b border-gray-100' : ''
          }`}
        >
          <span className="text-gray-800 font-medium truncate pr-4">{concept.conceptName}</span>
          <div className="flex items-center gap-2 pr-4">
            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.round(concept.avgScore))}%` }}
              />
            </div>
            <span className="text-gray-600 text-xs w-8 text-right shrink-0">
              {Math.round(concept.avgScore)}%
            </span>
          </div>
          <span className="text-gray-600">{concept.attemptCount}</span>
          <span className="text-gray-600">{concept.studentCount}</span>
        </div>
      ))}
    </div>
  )
}
