import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import { GetStudentCoursesResponse, GetStudentInvitesResponse, GetReviewConceptsResponse } from '@metis/types'
import CourseInviteCard from './CourseInviteCard'
import { timedFetch } from '@/lib/timed-fetch'

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')
  if (session.user.user_metadata?.role !== 'STUDENT') redirect('/teacher/dashboard')

  const [coursesRes, invitesRes, reviewRes] = await Promise.all([
    timedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/student/courses`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      next: { revalidate: 60 },
    }),
    timedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/student/invites`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    }),
    timedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/student/review`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    }),
  ])

  const active: GetStudentCoursesResponse = coursesRes.ok ? await coursesRes.json() : []
  const pending: GetStudentInvitesResponse = invitesRes.ok ? await invitesRes.json() : []
  const reviewConcepts: GetReviewConceptsResponse = reviewRes.ok ? await reviewRes.json() : []
  const reviewCount = reviewConcepts.length

  return (
    <div className="flex min-h-screen">
      <Sidebar role="STUDENT" />

      <main className="flex-1 p-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-gray-500 mb-8">{session.user.email}</p>

        {/* Review nudge — shown only when concepts are due */}
        {reviewCount > 0 && (
          <div className="mb-8 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {reviewCount} concept{reviewCount !== 1 ? 's' : ''} due for review
                </p>
                <p className="text-xs text-amber-600 mt-0.5">Scores are decaying — revisit before they slip</p>
              </div>
            </div>
            <Link
              href="/student/review"
              className="bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-lg whitespace-nowrap hover:bg-gray-700 transition-colors"
            >
              Review now
            </Link>
          </div>
        )}

        {/* Pending invitations */}
        {pending.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">Invitations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pending.map(item => (
                <CourseInviteCard key={item.enrollmentId} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* Active courses — action first */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">Continue learning</h2>
          {active.length > 0 ? (
            <div className="flex flex-col gap-3">
              {active.map(item => {
                const hasStarted = item.overallProgress > 0
                const sessionHref = hasStarted && item.lastModuleId
                  ? `/student/courses/${item.course.id}/module/${item.lastModuleId}/session`
                  : `/student/courses/${item.course.id}`

                return (
                  <div
                    key={item.enrollmentId}
                    className="rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-6 hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    {/* Course info */}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/student/courses/${item.course.id}`}
                        className="font-semibold text-gray-900 hover:text-gray-600 transition-colors"
                      >
                        {item.course.name}
                      </Link>

                      {/* Current module or subject */}
                      <p className="text-sm text-gray-400 mt-0.5 truncate">
                        {item.lastModuleName
                          ? `↳ ${item.lastModuleName}`
                          : item.course.subject}
                      </p>

                      {/* Progress bar */}
                      {hasStarted && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full bg-green-400 transition-all"
                              style={{ width: `${item.overallProgress}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 tabular-nums shrink-0">
                            {Math.round(item.overallProgress)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    <Link
                      href={sessionHref}
                      className="bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-lg whitespace-nowrap hover:bg-gray-700 transition-colors shrink-0"
                    >
                      {hasStarted ? 'Continue' : 'Start'}
                    </Link>
                  </div>
                )
              })}
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
