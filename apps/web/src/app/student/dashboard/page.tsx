import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default async function StudentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (user.user_metadata?.role !== 'STUDENT') redirect('/teacher/dashboard')

  return (
    <div className="flex min-h-screen">
      <Sidebar role="STUDENT" />

      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-2">Welcome back</h1>
        <p className="text-gray-500 mb-8">{user.email}</p>

        {/* Course cards — empty state */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Your courses</h2>
          <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
            <p className="text-sm">You're not enrolled in any courses yet.</p>
            <p className="text-sm mt-1">Your teacher will send you an invitation.</p>
          </div>
        </section>
      </main>
    </div>
  )
}
