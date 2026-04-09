'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { useGenerationPoller } from '@/app/teacher/TeacherGenerationPoller'

export default function RetryGenerationButton({ courseId }: { courseId: number }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { wakePoller } = useGenerationPoller()

  async function handleRetry(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses/${courseId}/generate`, {
      method: 'POST',
    })
    wakePoller()
    router.refresh()
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="text-xs text-red-600 font-medium hover:underline disabled:opacity-50"
    >
      {loading ? 'Retrying...' : 'Retry generation'}
    </button>
  )
}
