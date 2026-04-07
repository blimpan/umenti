'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'

export default function DeleteCourseButton({ courseId }: { courseId: number }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses/${courseId}`, {
      method: 'DELETE',
    })
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={handleDelete} disabled={loading}
          className="text-xs text-red-600 font-medium hover:underline disabled:opacity-50">
          {loading ? 'Deleting...' : 'Confirm'}
        </button>
        <button onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:underline">
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="text-xs text-gray-400 hover:text-red-500 transition-colors">
      Delete
    </button>
  )
}
