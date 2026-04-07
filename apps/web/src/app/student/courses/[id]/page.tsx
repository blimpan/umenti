import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { CourseOverview, GetConceptProgressResponse } from '@metis/types'
import { timedFetch } from '@/lib/timed-fetch'

interface Props {
  params: Promise<{ id: string }>
}

// Maps a 0–100 effective score to a green background tint.
// Used on individual concept rows only.
function scoreStyle(score: number): React.CSSProperties {
  const alpha = (score / 100) * 0.35
  return { backgroundColor: `rgba(34, 197, 94, ${alpha})` }
}

export default async function StudentCoursePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const [courseRes, progressRes] = await Promise.all([
    timedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/student/courses/${id}/overview`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    }),
    timedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/student/courses/${id}/progress`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    }),
  ])

  if (courseRes.status === 404) redirect('/student/dashboard')
  if (!courseRes.ok) throw new Error('Failed to load course')

  const course: CourseOverview = await courseRes.json()
  const progress: GetConceptProgressResponse = progressRes.ok ? await progressRes.json() : []

  const progressMap = new Map(progress.map(p => [p.conceptId, p.effectiveScore]))

  const moduleAvgScores = course.modules.map(m => {
    if (m.concepts.length === 0) return 0
    const sum = m.concepts.reduce((acc, c) => acc + (progressMap.get(c.id) ?? 0), 0)
    return sum / m.concepts.length
  })

  const overallAvg = moduleAvgScores.length > 0
    ? moduleAvgScores.reduce((a, b) => a + b, 0) / moduleAvgScores.length
    : 0

  const hasStarted = progress.length > 0

  const continueModuleId =
    course.modules.find((_, i) => moduleAvgScores[i] < 80)?.id ??
    course.modules[course.modules.length - 1]?.id

  return (
    <div className="flex min-h-screen">
      <Sidebar role="STUDENT" />

      <main className="flex-1 p-8 max-w-3xl">
        <Link href="/student/dashboard" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Dashboard
        </Link>

        {/* Course header */}
        <div className="mt-4 mb-8">
          <h1 className="text-2xl font-bold mb-1">{course.name}</h1>
          <p className="text-gray-500 mb-4">{course.subject}</p>

          {hasStarted && (
            <div className="mb-5">
              <div className="flex justify-between text-sm text-gray-500 mb-1">
                <span>Overall progress</span>
                <span>{Math.round(overallAvg)}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${overallAvg}%`, backgroundColor: 'rgba(34, 197, 94, 0.8)' }}
                />
              </div>
            </div>
          )}

          {continueModuleId && (
            <Link
              href={`/student/courses/${id}/module/${continueModuleId}`}
              className="inline-block bg-black text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              {hasStarted ? 'Continue' : 'Start course'}
            </Link>
          )}
        </div>

        {/* Module list */}
        <div className="space-y-4">
          {course.modules.map((module, i) => {
            const moduleAvg = moduleAvgScores[i]
            const visitedCount = module.concepts.filter(c => (progressMap.get(c.id) ?? 0) > 0).length
            const totalCount = module.concepts.length

            const subtitle = visitedCount > 0 && totalCount > 0
              ? `${visitedCount} of ${totalCount} concepts covered`
              : module.whyThisModule ?? null

            return (
              <div key={module.id} className="rounded-xl border border-gray-200 overflow-hidden">

                {/* Module header */}
                <Link
                  href={`/student/courses/${id}/module/${module.id}`}
                  className="flex items-center justify-between p-5 hover:bg-gray-50 transition-all"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {i + 1}. {module.name}
                    </p>
                    {subtitle && (
                      <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
                    )}
                  </div>
                </Link>

                {/* Progress bar — always rendered as visual separator, fill reflects score */}
                <div className="h-[3px] bg-gray-100">
                  {moduleAvg > 0 && (
                    <div
                      className="h-[3px] bg-green-400 transition-all"
                      style={{ width: `${moduleAvg}%` }}
                    />
                  )}
                </div>

                {/* Concept rows */}
                {module.concepts.length > 0 && (
                  <div className="divide-y divide-gray-100">
                    {module.concepts.map(concept => {
                      const conceptScore = progressMap.get(concept.id) ?? 0
                      return (
                        <div
                          key={concept.id}
                          className="flex items-center justify-between px-5 py-3"
                          style={conceptScore > 0 ? scoreStyle(conceptScore) : undefined}
                        >
                          <p className="text-sm text-gray-700">{concept.name}</p>
                          {conceptScore > 0 && (
                            <span className="text-xs font-medium text-green-800">
                              {Math.round(conceptScore)}%
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
