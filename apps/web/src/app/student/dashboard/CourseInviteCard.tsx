'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { StudentCourseItem } from '@metis/types'

const API = process.env.NEXT_PUBLIC_API_URL

interface Props {
  item: StudentCourseItem
}

export default function CourseInviteCard({ item }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null)

  async function respond(status: 'ACTIVE' | 'REJECTED') {
    setLoading(status === 'ACTIVE' ? 'accept' : 'reject')
    const { data: { session } } = await createClient().auth.getSession()
    await fetch(`${API}/api/enrollments/${item.enrollmentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session!.access_token}`,
      },
      body: JSON.stringify({ status }),
    })
    setLoading(null)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-gray-200 p-6 space-y-4">
      <div>
        <p className="font-semibold">{item.course.name}</p>
        <p className="text-sm text-gray-500 mt-1">{item.course.subject}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => respond('ACTIVE')}
          disabled={loading !== null}
          className="flex-1 text-sm font-medium bg-primary text-white py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading === 'accept' ? 'Accepting...' : 'Accept'}
        </button>
        <button
          onClick={() => respond('REJECTED')}
          disabled={loading !== null}
          className="flex-1 text-sm font-medium border border-gray-200 text-gray-600 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading === 'reject' ? 'Declining...' : 'Decline'}
        </button>
      </div>
    </div>
  )
}
