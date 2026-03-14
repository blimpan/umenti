import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { CourseDetail } from '@metis/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function StudentCoursePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  })

  if (res.status === 404) redirect('/student/dashboard')
  if (!res.ok) throw new Error('Failed to load course')

  const course: CourseDetail = await res.json()

  return (
    <div className="flex min-h-screen">
      <Sidebar role="STUDENT" />

      <main className="flex-1 p-8 max-w-3xl">
        <Link href="/student/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Dashboard
        </Link>

        <h1 className="text-2xl font-bold mt-4 mb-1">{course.name}</h1>
        <p className="text-gray-500 mb-8">{course.subject}</p>

        <div className="space-y-3">
          {course.modules.map((module, i) => (
            <div key={module.id} className="rounded-xl border border-gray-200 p-5">
              <p className="font-semibold text-gray-900">
                {i + 1}. {module.name}
              </p>
              {module.whyThisModule && (
                <p className="text-sm text-gray-500 mt-1">{module.whyThisModule}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {module.concepts.length} concept{module.concepts.length !== 1 ? 's' : ''} ·{' '}
                {module.exercises.length} exercise{module.exercises.length !== 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
