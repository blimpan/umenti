import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { GetStudentCoursesResponse, GetStudentInvitesResponse } from '@metis/types'
import { timedFetch } from '@/lib/timed-fetch'

export default async function MyCoursesPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')
  if (session.user.user_metadata?.role !== 'STUDENT') redirect('/teacher/dashboard')

  const [coursesRes, invitesRes] = await Promise.all([
    timedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/student/courses`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    }),
    timedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/student/invites`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    }),
  ])

  const active: GetStudentCoursesResponse = coursesRes.ok ? await coursesRes.json() : []
  const pending: GetStudentInvitesResponse = invitesRes.ok ? await invitesRes.json() : []

  return (
    <div className="flex min-h-screen">
      <Sidebar role="STUDENT" />

      <main className="flex-1 p-8 max-w-3xl">
        <h1 className="text-2xl font-bold mb-1">My Courses</h1>
        <p className="text-gray-500 mb-8">
          {active.length > 0
            ? `${active.length} active enrollment${active.length !== 1 ? 's' : ''}`
            : 'No active enrollments'}
        </p>

        {/* Active enrollments */}
        {active.length > 0 && (
          <section className="mb-10">
            <div className="rounded-xl border border-gray-200 overflow-hidden">

              {/* Header row */}
              <div
                className="grid px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold uppercase tracking-widest text-gray-400 gap-4"
                style={{ gridTemplateColumns: '1fr 160px 80px' }}
              >
                <span>Course</span>
                <span>Last module</span>
                <span className="text-right">Progress</span>
              </div>

              <div className="divide-y divide-gray-100">
                {active.map(item => {
                  const hasStarted = item.overallProgress > 0
                  const sessionHref = hasStarted && item.lastModuleId
                    ? `/student/courses/${item.course.id}/module/${item.lastModuleId}/session`
                    : `/student/courses/${item.course.id}`

                  return (
                    <div
                      key={item.enrollmentId}
                      className="grid items-center px-5 py-4 hover:bg-gray-50 transition-colors gap-4 group"
                      style={{ gridTemplateColumns: '1fr 160px 80px' }}
                    >
                      {/* Course name + subject */}
                      <div className="min-w-0">
                        <Link
                          href={`/student/courses/${item.course.id}`}
                          className="font-medium text-gray-900 hover:text-gray-600 transition-colors text-sm truncate block"
                        >
                          {item.course.name}
                        </Link>
                        <p className="text-xs text-gray-400 mt-0.5">{item.course.subject}</p>
                      </div>

                      {/* Last module */}
                      <div className="min-w-0">
                        {item.lastModuleName ? (
                          <Link
                            href={sessionHref}
                            className="text-xs text-gray-600 hover:text-gray-900 transition-colors truncate block"
                          >
                            {item.lastModuleName}
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-300">Not started</span>
                        )}
                      </div>

                      {/* Progress */}
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full bg-green-400 transition-all"
                            style={{ width: `${item.overallProgress}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 tabular-nums w-8 text-right shrink-0">
                          {Math.round(item.overallProgress)}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* Pending invitations */}
        {pending.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
              Pending invitations
            </h2>
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {pending.map(item => (
                  <div key={item.enrollmentId} className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.course.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.course.subject}</p>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {active.length === 0 && pending.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
            <p className="text-sm">You're not enrolled in any courses yet.</p>
            <p className="text-sm mt-1">Your teacher will send you an invitation.</p>
          </div>
        )}
      </main>
    </div>
  )
}
