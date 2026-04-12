import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { GenerationPollerProvider } from './TeacherGenerationPoller'

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.user_metadata?.role !== 'TEACHER') redirect('/student/dashboard')

  const userName = user.user_metadata?.full_name ?? user.email ?? 'Teacher'

  return (
    <GenerationPollerProvider>
      <div className="flex min-h-screen">
        <Sidebar role="TEACHER" userName={userName} />
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </GenerationPollerProvider>
  )
}
