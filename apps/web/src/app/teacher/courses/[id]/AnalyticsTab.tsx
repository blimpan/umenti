'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { CourseAnalyticsStudent, AttemptsOverTimePoint, GetCourseAnalyticsResponse } from '@metis/types'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

const API = process.env.NEXT_PUBLIC_API_URL

type SortKey = 'email' | 'progress' | 'lastActiveAt'
type SortDir = 'asc' | 'desc'

function formatLastActive(iso: string | null): string {
  if (!iso) return 'Never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  const hours = Math.floor(diffMs / 3_600_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function sortStudents(
  students: CourseAnalyticsStudent[],
  sortBy: SortKey,
  sortDir: SortDir
): CourseAnalyticsStudent[] {
  return [...students].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'email') {
      cmp = a.email.localeCompare(b.email)
    } else if (sortBy === 'progress') {
      if (a.progress === null && b.progress === null) return 0
      if (a.progress === null) return 1
      if (b.progress === null) return -1
      cmp = a.progress - b.progress
    } else {
      if (!a.lastActiveAt && !b.lastActiveAt) return 0
      if (!a.lastActiveAt) return 1
      if (!b.lastActiveAt) return -1
      cmp = new Date(a.lastActiveAt).getTime() - new Date(b.lastActiveAt).getTime()
    }
    return sortDir === 'asc' ? cmp : -cmp
  })
}

function SortIcon({ col, sortBy, sortDir }: { col: SortKey; sortBy: SortKey; sortDir: SortDir }) {
  if (col !== sortBy) return <span className="text-gray-300 ml-1">↕</span>
  return <span className="text-primary ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

function AttemptsChart({
  data,
  granularity,
}: {
  data: AttemptsOverTimePoint[]
  granularity: 'hour' | 'day' | 'week'
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 rounded-xl border border-gray-200 bg-gray-50 mb-8">
        <p className="text-sm text-gray-400">No exercise attempts yet.</p>
      </div>
    )
  }

  function formatTick(d: string): string {
    const date = new Date(d)
    if (granularity === 'hour') {
      return date.toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric' })
    }
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }

  function formatLabel(d: unknown): string {
    const date = new Date(String(d))
    if (granularity === 'hour') {
      return date.toLocaleString('en', {
        month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    }
    if (granularity === 'week') {
      return `Week of ${date.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })}`
    }
    return date.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="mb-8">
      <p className="text-sm font-semibold text-gray-900 mb-4">Exercise attempts over time</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickFormatter={formatTick}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
            labelFormatter={formatLabel}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          />
          <Line type="monotone" dataKey="total"     name="Total"     stroke="#111827" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="correct"   name="Correct"   stroke="#16a34a" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="incorrect" name="Incorrect" stroke="#dc2626" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface Props {
  courseId: number
}

export default function AnalyticsTab({ courseId }: Props) {
  const [students, setStudents] = useState<CourseAnalyticsStudent[]>([])
  const [attemptsOverTime, setAttemptsOverTime] = useState<AttemptsOverTimePoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('lastActiveAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [granularity, setGranularity] = useState<'hour' | 'day' | 'week'>('day')

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const res = await apiFetch(`${API}/api/courses/${courseId}/analytics`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error('Failed to load analytics')
        const data: GetCourseAnalyticsResponse = await res.json()
        setStudents(data.students)
        setAttemptsOverTime(data.attemptsOverTime)
        setGranularity(data.granularity)
        setLoading(false)
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setError('Could not load student analytics. Please try again.')
        setLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [courseId])

  function handleSort(key: SortKey) {
    if (key === sortBy) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir(key === 'email' ? 'asc' : 'desc')
    }
  }

  const sorted = sortStudents(students, sortBy, sortDir)

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-[232px] bg-gray-100 rounded-xl animate-pulse mb-8" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>
  }

  return (
    <div>
      <AttemptsChart data={attemptsOverTime} granularity={granularity} />

      <div className="flex items-baseline justify-between mb-5">
        <p className="text-sm font-semibold text-gray-900">Student progress</p>
        <p className="text-sm text-gray-400">{students.length} student{students.length !== 1 ? 's' : ''} enrolled</p>
      </div>

      {students.length === 0 ? (
        <p className="text-sm text-gray-400">No students enrolled in this course yet.</p>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_140px] bg-gray-50 border-b border-gray-200 px-4 py-2">
            {(
              [
                { key: 'email',        label: 'Student' },
                { key: 'progress',     label: 'Progress' },
                { key: 'lastActiveAt', label: 'Last active' },
              ] as { key: SortKey; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleSort(key)}
                className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600 transition-colors flex items-center"
              >
                {label}
                <SortIcon col={key} sortBy={sortBy} sortDir={sortDir} />
              </button>
            ))}
          </div>

          {sorted.map((student, i) => (
            <div
              key={student.email}
              className={`grid grid-cols-[1fr_100px_140px] px-4 py-3 items-center text-sm ${
                i < sorted.length - 1 ? 'border-b border-gray-100' : ''
              } hover:bg-gray-50 transition-colors`}
            >
              <span className="text-gray-800 truncate">{student.email}</span>
              <span className="text-gray-800">
                {student.progress === null ? '—' : `${Math.round(student.progress)}%`}
              </span>
              <span className="text-gray-500">{formatLastActive(student.lastActiveAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
