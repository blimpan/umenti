import { CourseDetail } from '@metis/types'
import StudentsSection from './StudentsSection'

interface Props {
  course: CourseDetail
  onOpenModule: (moduleId: number) => void
}

const REVIEW_BORDER: Record<string, string> = {
  UNREVIEWED: 'border-l-gray-200',
  IN_REVIEW:  'border-l-yellow-400',
  APPROVED:   'border-l-green-400',
}

const REVIEW_BADGE: Record<string, string> = {
  UNREVIEWED: 'bg-gray-100 text-gray-500',
  IN_REVIEW:  'bg-yellow-50 text-yellow-700',
  APPROVED:   'bg-green-50 text-green-700',
}

const REVIEW_LABEL: Record<string, string> = {
  UNREVIEWED: 'Unreviewed',
  IN_REVIEW:  'In review',
  APPROVED:   'Approved',
}

export default function OverviewTab({ course, onOpenModule }: Props) {
  const totalConcepts = course.modules.reduce((sum, m) => sum + m.concepts.length, 0)
  const totalExercises = course.modules.reduce((sum, m) => sum + m.exercises.length, 0)
  const approvedCount = course.modules.filter((m) => m.reviewStatus === 'APPROVED').length

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Modules', value: course.modules.length },
          { label: 'Concepts', value: totalConcepts },
          { label: 'Exercises', value: totalExercises },
          { label: 'Approved', value: `${approvedCount} / ${course.modules.length}` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-gray-200 p-5">
            <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Review progress bar */}
      {course.modules.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Review progress</span>
            <span>
              {approvedCount} of {course.modules.length} modules approved
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{
                width: `${course.modules.length ? (approvedCount / course.modules.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Module list */}
      <div>
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
          Modules
        </h2>
        <div className="space-y-2">
          {course.modules.map((module) => (
            <button
              key={module.id}
              onClick={() => onOpenModule(module.id)}
              className={`w-full text-left rounded-xl border-l-4 border border-gray-200 p-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4 ${REVIEW_BORDER[module.reviewStatus]}`}
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{module.name}</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {module.concepts.length} concept{module.concepts.length !== 1 ? 's' : ''} ·{' '}
                  {module.exercises.length} exercise{module.exercises.length !== 1 ? 's' : ''}
                </p>
              </div>
              <span
                className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${REVIEW_BADGE[module.reviewStatus]}`}
              >
                {REVIEW_LABEL[module.reviewStatus]}
              </span>
            </button>
          ))}

          {course.modules.length === 0 && (
            <p className="text-gray-400 text-sm py-4">
              No modules yet — check back when generation is complete.
            </p>
          )}
        </div>
      </div>

      {/* Status banners */}
      {course.status === 'DRAFT' &&
        approvedCount > 0 &&
        approvedCount < course.modules.length && (
          <div className="mt-8 p-4 rounded-xl bg-yellow-50 border border-yellow-100 text-sm text-yellow-800">
            {approvedCount} of {course.modules.length} modules approved — continue reviewing
            content before publishing.
          </div>
        )}
      {course.status === 'DRAFT' &&
        approvedCount === course.modules.length &&
        course.modules.length > 0 && (
          <div className="mt-8 p-4 rounded-xl bg-green-50 border border-green-100 text-sm text-green-800">
            All modules approved — this course is ready to publish.
          </div>
        )}

      {/* Students */}
      <div className="mt-10">
        <StudentsSection courseId={course.id} />
      </div>
    </div>
  )
}
