import { createClient } from '@/lib/supabase/server'
import type { GetCoursesResponse, CourseStatus } from '@metis/types'
import Link from 'next/link'
import DeleteCourseButton from './DeleteCourseButton'

export default async function MyCoursesPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses`, {
    headers: { Authorization: `Bearer ${session!.access_token}` },
    cache: 'no-store',
  })

  const courses: GetCoursesResponse = res.ok ? await res.json() : []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My courses</h1>
        <Link
          href="/teacher/courses/new"
          className="bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          + New course
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {courses.map((course) => (
          <Link
            key={course.id}
            href={`/teacher/courses/${course.id}`}
            className="rounded-xl border border-gray-200 p-6 space-y-3 hover:border-primary/40 hover:shadow-sm transition-all block"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{course.name}</p>
                <p className="text-sm text-gray-500">{course.subject}</p>
              </div>
              <StatusBadge status={course.status} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Created {new Date(course.createdAt).toLocaleDateString()}
              </p>
              <DeleteCourseButton courseId={course.id} />
            </div>
          </Link>
        ))}

        {courses.length === 0 && (
          <Link
            href="/teacher/courses/new"
            className="rounded-xl border-2 border-dashed border-gray-300 p-8 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary hover:text-primary transition-colors"
          >
            <span className="text-3xl font-light">+</span>
            <span className="text-sm font-medium">Create your first course</span>
          </Link>
        )}
      </div>
    </div>
  )
}

const STATUS_STYLES: Record<CourseStatus, string> = {
  GENERATING: 'bg-blue-50 text-blue-600',
  FAILED:     'bg-red-50 text-red-600',
  DRAFT:      'bg-yellow-50 text-yellow-700',
  PUBLISHED:  'bg-green-50 text-green-700',
  UNPUBLISHED:'bg-orange-50 text-orange-700',
  ARCHIVED:   'bg-gray-100 text-gray-500',
}

function StatusBadge({ status }: { status: CourseStatus }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[status]}`}>
      {status.toLowerCase()}
    </span>
  )
}
