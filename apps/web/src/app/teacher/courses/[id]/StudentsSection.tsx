'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CourseEnrollment } from '@metis/types'

const API = process.env.NEXT_PUBLIC_API_URL

async function getToken() {
  const { data: { session } } = await createClient().auth.getSession()
  return session!.access_token
}

interface Props {
  courseId: number
}

export default function StudentsSection({ courseId }: Props) {
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getToken().then(token =>
      fetch(`${API}/api/courses/${courseId}/enrollments`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(setEnrollments)
    )
  }, [courseId])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // TODO(human): Implement the invite submission.
    //
    // 1. Set loading = true.
    // 2. Get the auth token using getToken() (already defined above).
    // 3. POST to `${API}/api/courses/${courseId}/enrollments` with body { email },
    //    Authorization header, and Content-Type: application/json.
    // 4. If res.status === 201:
    //    - Parse the response JSON to get the new enrollment id and status.
    //    - Add a new CourseEnrollment to the enrollments state:
    //      { id, email, status, userId: null, createdAt: new Date().toISOString() }
    //    - Clear the email input (setEmail('')).
    // 5. If res.status === 409: setError('This email has already been invited').
    // 6. Any other non-ok status: setError('Failed to send invitation').
    // 7. Set loading = false.
  }

  const active = enrollments.filter(e => e.status === 'ACTIVE')
  const pending = enrollments.filter(e => e.status === 'PENDING')

  return (
    <div>
      <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Students</h2>

      {/* Enrolled */}
      {active.length > 0 && (
        <div className="space-y-2 mb-4">
          {active.map(e => (
            <div key={e.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200">
              <span className="text-sm text-gray-700">{e.email}</span>
              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Enrolled</span>
            </div>
          ))}
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div className="space-y-2 mb-4">
          {pending.map(e => (
            <div key={e.id} className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200">
              <span className="text-sm text-gray-500">{e.email}</span>
              <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">Pending</span>
            </div>
          ))}
        </div>
      )}

      {enrollments.length === 0 && (
        <p className="text-sm text-gray-400 mb-4">No students invited yet.</p>
      )}

      {/* Invite form */}
      <form onSubmit={handleInvite} className="flex gap-2 mt-2">
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="student@email.com"
          required
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          disabled={loading}
          className="text-sm font-medium bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Inviting...' : 'Invite'}
        </button>
      </form>

      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  )
}
