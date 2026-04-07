import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GetCourseModuleResponse } from '@metis/types'
import SessionShell from './SessionShell'
import { timedFetch } from '@/lib/timed-fetch'

interface Props {
  params: Promise<{ id: string; moduleId: string }>
}

export default async function SessionPage({ params }: Props) {
  const { id: courseId, moduleId } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const res = await timedFetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/student/courses/${courseId}/modules/${moduleId}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    }
  )

  if (res.status === 404) redirect('/student/dashboard')
  if (!res.ok) throw new Error('Failed to load module')

  const data: GetCourseModuleResponse = await res.json()

  return (
    <SessionShell
      courseId={courseId}
      courseName={data.courseName}
      currentModule={data.module}
      allModules={data.allModules}
    />
  )
}
