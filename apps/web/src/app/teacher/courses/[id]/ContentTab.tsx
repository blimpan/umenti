'use client'

import { CourseDetail } from '@metis/types'
import ModuleEditor from './ModuleEditor'

const REVIEW_BADGE: Record<string, string> = {
  UNREVIEWED: 'bg-gray-100 text-gray-500',
  IN_REVIEW:  'bg-yellow-50 text-yellow-700',
  APPROVED:   'bg-green-50 text-green-700',
}

const REVIEW_LABEL: Record<string, string> = {
  UNREVIEWED: 'New',
  IN_REVIEW:  'In review',
  APPROVED:   'Approved',
}

interface Props {
  course: CourseDetail
  selectedModuleId: number | null
  onSelectModule: (id: number) => void
}

export default function ContentTab({ course, selectedModuleId, onSelectModule }: Props) {
  const approvedCount = course.modules.filter((m) => m.reviewStatus === 'APPROVED').length
  const selectedModule =
    course.modules.find((m) => m.id === selectedModuleId) ?? course.modules[0] ?? null

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Module sidebar */}
      <aside className="w-60 shrink-0 border-r bg-gray-50 flex flex-col overflow-hidden">
        <div className="p-4 border-b bg-white">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Modules</p>
          <p className="text-xs text-gray-400 mt-1">
            {approvedCount} / {course.modules.length} approved
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {course.modules.map((module) => (
            <button
              key={module.id}
              onClick={() => onSelectModule(module.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 flex items-center justify-between gap-2 transition-colors text-sm ${
                selectedModule?.id === module.id
                  ? 'bg-white shadow-sm font-medium text-gray-900'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              <span className="truncate">{module.name}</span>
              <span
                className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${REVIEW_BADGE[module.reviewStatus]}`}
              >
                {REVIEW_LABEL[module.reviewStatus]}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Module editor */}
      <main className="flex-1 overflow-y-auto bg-white">
        {selectedModule ? (
          <ModuleEditor module={selectedModule} courseId={course.id} />
        ) : (
          <div className="p-8 text-gray-400 text-sm">No modules to show.</div>
        )}
      </main>
    </div>
  )
}
