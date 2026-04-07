'use client'

import { useEffect, useState } from 'react'
import { CourseEnrollment } from '@metis/types'
import { apiFetch } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL

interface Props {
  courseId: number
}

export default function StudentsSection({ courseId }: Props) {
  const [enrollments, setEnrollments] = useState<CourseEnrollment[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null)

  useEffect(() => {
    apiFetch(`${API}/api/courses/${courseId}/enrollments`)
      .then(r => r.json())
      .then(setEnrollments)
  }, [courseId])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    setLoading(true)
    try {
      const res = await apiFetch(`${API}/api/courses/${courseId}/enrollments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      if (res.status === 201 || res.status === 200) {
        const { id, status } = await res.json()
        setEnrollments([{ id, email, status, userId: null, createdAt: new Date().toISOString() }, ...enrollments])
        setEmail('')
      } else if (res.status === 409) {
        setError('This email has already been invited')
      } else {
        setError('Failed to send invitation')
        console.error('Failed to send invitation:', res.status, res.statusText)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleWithdraw(enrollmentId: number) {
    setWithdrawingId(enrollmentId)
    try {
      const res = await apiFetch(`${API}/api/enrollments/${enrollmentId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setEnrollments(prev => prev.filter(e => e.id !== enrollmentId))
      }
    } finally {
      setWithdrawingId(null)
    }
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
              <div className="flex items-center gap-2">
                <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">Pending</span>
                <button
                  onClick={() => handleWithdraw(e.id)}
                  disabled={withdrawingId === e.id}
                  className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                >
                  {withdrawingId === e.id ? 'Withdrawing…' : 'Withdraw'}
                </button>
              </div>
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
