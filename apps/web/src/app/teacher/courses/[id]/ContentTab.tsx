'use client'

import { CourseDetail } from '@metis/types'
import ModuleEditor from './ModuleEditor'


interface Props {
  course: CourseDetail
  selectedModuleId: number | null
  onSelectModule: (id: number) => void
  onModuleApproved: (moduleId: number) => void
  onApprovalStart: () => void
  onApprovalEnd: () => void
}

export default function ContentTab({ course, selectedModuleId, onSelectModule, onModuleApproved, onApprovalStart, onApprovalEnd }: Props) {
  const approvedCount = course.modules.filter((m) => m.reviewStatus === 'APPROVED').length
  const selectedModule =
    course.modules.find((m) => m.id === selectedModuleId) ?? course.modules[0] ?? null

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Module sidebar */}
      <aside className="w-60 shrink-0 border-r bg-white flex flex-col overflow-hidden">
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
                  ? 'border border-teal-600 text-teal-600 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className="truncate">{module.name}</span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                module.reviewStatus === 'APPROVED'  ? 'bg-green-500' :
                module.reviewStatus === 'IN_REVIEW' ? 'bg-yellow-400' :
                'bg-gray-300'
              }`} />
            </button>
          ))}
        </nav>
      </aside>

      {/* Module editor */}
      <main className="flex-1 overflow-y-auto bg-white">
        {selectedModule ? (
          <ModuleEditor
            key={selectedModule.id}
            module={selectedModule}
            courseId={course.id}
            onApproved={() => onModuleApproved(selectedModule.id)}
            onApprovalStart={onApprovalStart}
            onApprovalEnd={onApprovalEnd}
          />
        ) : (
          <div className="p-8 text-gray-400 text-sm">No modules to show.</div>
        )}
      </main>
    </div>
  )
}
