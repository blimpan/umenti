import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

// The editor has moved to /teacher/courses/[id] (Content tab)
export default async function CourseEditorRedirect({ params }: Props) {
  const { id } = await params
  redirect(`/teacher/courses/${id}`)
}
