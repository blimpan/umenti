import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { GetReviewConceptsResponse } from '@metis/types'
import { timedFetch } from '@/lib/timed-fetch'
import ReviewTable from './ReviewTable'

export default async function ReviewPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')
  if (session.user.user_metadata?.role !== 'STUDENT') redirect('/teacher/dashboard')

  const userName = session.user.user_metadata?.full_name ?? session.user.email ?? 'Student'

  const res = await timedFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/student/review`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  })

  const concepts: GetReviewConceptsResponse = res.ok ? await res.json() : []

  return (
    <div className="flex min-h-screen">
      <Sidebar role="STUDENT" userName={userName} />

      <main className="flex-1 p-8 max-w-4xl">
        <div className="mb-8">
          <div className="flex items-baseline gap-3 mb-1">
            <h1 className="text-2xl font-bold">Review</h1>
            {concepts.length > 0 && (
              <span className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                {concepts.length} due
              </span>
            )}
          </div>
          <p className="text-gray-500">
            {concepts.length > 0
              ? 'Concepts you\'ve mastered are decaying — revisit them before they slip too far.'
              : 'All caught up — no concepts are due for review right now.'}
          </p>
        </div>

        <ReviewTable concepts={concepts} />
      </main>
    </div>
  )
}
