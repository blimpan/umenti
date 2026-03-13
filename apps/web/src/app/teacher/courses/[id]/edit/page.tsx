import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CourseDetail } from '@metis/types'
import CourseEditor from './CourseEditor'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CourseEditorPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  })

  if (res.status === 404) redirect('/teacher/courses')
  if (!res.ok) throw new Error('Failed to load course')

  const course: CourseDetail = await res.json()

  return <CourseEditor course={course} />
}
