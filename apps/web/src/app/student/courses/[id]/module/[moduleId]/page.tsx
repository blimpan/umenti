import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import { CourseOverview, GetConceptProgressResponse } from '@metis/types'
import { timedFetch } from '@/lib/timed-fetch'

interface Props {
  params: Promise<{ id: string; moduleId: string }>
}

// Same color utility as the course landing — maps a 0–100 effective score to a
// green background tint so both pages use a consistent visual language.
function scoreStyle(score: number): React.CSSProperties {
  const alpha = (score / 100) * 0.35
  return { backgroundColor: `rgba(34, 197, 94, ${alpha})` }
}

export default async function ModuleLandingPage({ params }: Props) {
  const { id: courseId, moduleId } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  // Fetch course and progress in parallel to minimise wait time
  const [courseRes, progressRes] = await Promise.all([
    timedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/student/courses/${courseId}/overview`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      next: { revalidate: 300 },
    }),
    timedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/student/courses/${courseId}/progress`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    }),
  ])

  if (courseRes.status === 404) redirect('/student/dashboard')
  if (!courseRes.ok) throw new Error('Failed to load course')

  const course: CourseOverview = await courseRes.json()
  const progress: GetConceptProgressResponse = progressRes.ok ? await progressRes.json() : []

  const moduleIndex = course.modules.findIndex(m => m.id === parseInt(moduleId))
  if (moduleIndex === -1) redirect(`/student/courses/${courseId}`)
  const module = course.modules[moduleIndex]

  const progressMap = new Map(progress.map(p => [p.conceptId, p.effectiveScore]))

  return (
    <div className="flex min-h-screen">
      <Sidebar role="STUDENT" />

      <main className="flex-1 p-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link href="/student/dashboard" className="hover:text-gray-600 transition-colors">Dashboard</Link>
          <span>/</span>
          <Link href={`/student/courses/${courseId}`} className="hover:text-gray-600 transition-colors">{course.name}</Link>
          <span>/</span>
          <span className="text-gray-600">{module.name}</span>
        </div>

        <div className="flex gap-10 items-start">

          {/* Left column — module context */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-400 mb-1">Module {moduleIndex + 1}</p>
            <h1 className="text-2xl font-bold mb-6">{module.name}</h1>

            {module.whyThisModule && (
              <section className="mb-5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Why this module</h2>
                <p className="text-gray-700 text-sm leading-relaxed">{module.whyThisModule}</p>
              </section>
            )}

            {module.buildsOn && (
              <section className="mb-5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Builds on</h2>
                <p className="text-gray-700 text-sm leading-relaxed">{module.buildsOn}</p>
              </section>
            )}

            {module.leadsInto && (
              <section className="mb-5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Leads into</h2>
                <p className="text-gray-700 text-sm leading-relaxed">{module.leadsInto}</p>
              </section>
            )}

            {module.outcomes.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Learning outcomes</h2>
                <ul className="space-y-1.5">
                  {module.outcomes.map(outcome => (
                    <li key={outcome.id} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-gray-300 mt-0.5">→</span>
                      <span>{outcome.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Enter module CTA */}
            <Link
              href={`/student/courses/${courseId}/module/${moduleId}/session`}
              className="inline-block bg-black text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Enter module
            </Link>
          </div>

          {/* Right column — concept map */}
          <div className="w-72 shrink-0">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Concepts</h2>
            <div className="space-y-2">
              {module.concepts.map((concept, i) => {
                const score = progressMap.get(concept.id) ?? 0
                return (
                  <div
                    key={concept.id}
                    className="rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between"
                    style={score > 0 ? scoreStyle(score) : undefined}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Concept order number */}
                      <span className="text-xs text-gray-400 shrink-0">{i + 1}</span>
                      <p className="text-sm text-gray-800 truncate">{concept.name}</p>
                    </div>
                    {score > 0 && (
                      <span className="text-xs font-medium text-green-800 ml-3 shrink-0">
                        {Math.round(score)}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
