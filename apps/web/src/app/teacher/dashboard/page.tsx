import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'

export default async function TeacherDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (user.user_metadata?.role !== 'TEACHER') redirect('/student/dashboard')

  return (
    <div className="flex min-h-screen">
      <Sidebar role="TEACHER" />

      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-2">Your courses</h1>
        <p className="text-gray-500 mb-8">{user.email}</p>

        {/* Course grid — empty state + create card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/teacher/courses/new"
            className="rounded-xl border-2 border-dashed border-gray-300 p-8 flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-accent hover:text-accent transition-colors"
          >
            <span className="text-3xl font-light">+</span>
            <span className="text-sm font-medium">Create new course</span>
          </Link>
        </div>
      </main>
    </div>
  )
}
