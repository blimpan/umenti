import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { GetStudentCoursesResponse } from '@metis/types'
import CourseInviteCard from './CourseInviteCard'

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')
  if (session.user.user_metadata?.role !== 'STUDENT') redirect('/teacher/dashboard')

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/student/courses`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  })

  const courses: GetStudentCoursesResponse = res.ok ? await res.json() : []

  const active = courses.filter(c => c.enrollmentStatus === 'ACTIVE')
  const pending = courses.filter(c => c.enrollmentStatus === 'PENDING')

  return (
    <div className="flex min-h-screen">
      <Sidebar role="STUDENT" />

      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
        <p className="text-gray-500 mb-8">{session.user.email}</p>

        {/* Pending invitations */}
        {pending.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4">Invitations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pending.map(item => (
                <CourseInviteCard key={item.enrollmentId} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* Enrolled courses */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Your courses</h2>
          {active.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {active.map(item => (
                <Link
                  key={item.enrollmentId}
                  href={`/student/courses/${item.course.id}`}
                  className="rounded-xl border border-gray-200 p-6 hover:border-primary/40 hover:shadow-sm transition-all block"
                >
                  <p className="font-semibold">{item.course.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{item.course.subject}</p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
              <p className="text-sm">You're not enrolled in any courses yet.</p>
              <p className="text-sm mt-1">Your teacher will send you an invitation.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
