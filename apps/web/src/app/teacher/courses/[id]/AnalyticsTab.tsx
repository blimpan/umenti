'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import {
  CourseAnalyticsStudent,
  AttemptsOverTimePoint,
  GetCourseAnalyticsResponse,
  ConceptBreakdownItem,
  StudentConceptDetail,
  GetStudentConceptsResponse,
} from '@metis/types'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import ConceptBreakdownSection from './ConceptBreakdownSection'
import ExerciseAnalysisSection from './ExerciseAnalysisSection'

const API = process.env.NEXT_PUBLIC_API_URL

type SortKey = 'email' | 'progress' | 'lastActiveAt'
type SortDir = 'asc' | 'desc'
type AnalyticsSubTab = 'students' | 'concepts' | 'exercises'

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

// ---- Student concept drilldown ----

interface StudentConceptDrilldownProps {
  courseId: number
  userId: string
}

function StudentConceptDrilldown({ courseId, userId }: StudentConceptDrilldownProps) {
  const [concepts, setConcepts] = useState<StudentConceptDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await apiFetch(
          `${API}/api/courses/${courseId}/analytics/students/${userId}/concepts`
        )
        if (!res.ok) throw new Error('Failed')
        const data: GetStudentConceptsResponse = await res.json()
        if (!cancelled) {
          setConcepts(data.concepts)
          setLoading(false)
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }

    load()
    return () => { cancelled = true }
  }, [courseId, userId])

  if (loading) {
    return (
      <div className="px-4 py-3 bg-gray-50">
        <div className="space-y-1.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-6 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-3 bg-gray-50">
        <p className="text-xs text-red-500">Could not load concepts.</p>
      </div>
    )
  }

  if (concepts.length === 0) {
    return (
      <div className="px-4 py-3 bg-gray-50">
        <p className="text-xs text-gray-400">No concept data yet for this student.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Concept breakdown</p>
      <div className="space-y-1.5">
        {concepts.map(c => (
          <div key={c.conceptId} className="grid grid-cols-[1fr_80px_80px] items-center text-xs gap-2">
            <span className="text-gray-700 truncate">{c.conceptName}</span>
            <span className="text-gray-500">
              Raw: <span className="font-medium text-gray-700">{Math.round(c.score)}%</span>
            </span>
            <span className="text-gray-500">
              Decayed: <span className="font-medium text-gray-700">{Math.round(c.decayedScore)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---- Main component ----

const SUB_TABS: { key: AnalyticsSubTab; label: string }[] = [
  { key: 'students', label: 'Students' },
  { key: 'concepts', label: 'Concepts' },
  { key: 'exercises', label: 'Exercises' },
]

interface Props {
  courseId: number
}

export default function AnalyticsTab({ courseId }: Props) {
  const [students, setStudents] = useState<CourseAnalyticsStudent[]>([])
  const [attemptsOverTime, setAttemptsOverTime] = useState<AttemptsOverTimePoint[]>([])
  const [conceptBreakdown, setConceptBreakdown] = useState<ConceptBreakdownItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('lastActiveAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [granularity, setGranularity] = useState<'hour' | 'day' | 'week'>('day')
  const [subTab, setSubTab] = useState<AnalyticsSubTab>('students')
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

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
        setConceptBreakdown(data.conceptBreakdown)
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

  function toggleStudentExpand(userId: string) {
    setExpandedUserId(prev => (prev === userId ? null : userId))
  }

  const sorted = sortStudents(students, sortBy, sortDir)
  const atRiskCount = students.filter(s => s.atRisk).length

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

      {/* Sub-tab bar */}
      <div className="flex border-b border-gray-200 mb-6">
        {SUB_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              subTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Students sub-tab */}
      {subTab === 'students' && (
        <>
          <div className="flex items-baseline justify-between mb-5">
            <p className="text-sm font-semibold text-gray-900">Student progress</p>
            <div className="flex items-center gap-3">
              {atRiskCount > 0 && (
                <span className="text-xs font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                  {atRiskCount} at risk
                </span>
              )}
              <p className="text-sm text-gray-400">
                {students.length} student{students.length !== 1 ? 's' : ''} enrolled
              </p>
            </div>
          </div>

          {students.length === 0 ? (
            <p className="text-sm text-gray-400">No students enrolled in this course yet.</p>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_100px_140px_32px] bg-gray-50 border-b border-gray-200 px-4 py-2">
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
                <span />
              </div>

              {sorted.map((student, i) => (
                <div key={student.email}>
                  <button
                    onClick={() => toggleStudentExpand(student.userId)}
                    aria-expanded={expandedUserId === student.userId}
                    aria-label={`Show details for ${student.email}`}
                    className={`w-full grid grid-cols-[1fr_100px_140px_32px] px-4 py-3 items-center text-sm text-left ${
                      i < sorted.length - 1 || expandedUserId === student.userId
                        ? 'border-b border-gray-100'
                        : ''
                    } hover:bg-gray-50 transition-colors`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-gray-800 truncate">{student.email}</span>
                      {student.atRisk && (
                        <span className="shrink-0 text-xs font-medium bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full">
                          At risk
                        </span>
                      )}
                    </span>
                    <span className="text-gray-800">
                      {student.progress === null ? '—' : `${Math.round(student.progress)}%`}
                    </span>
                    <span className="text-gray-500">{formatLastActive(student.lastActiveAt)}</span>
                    <span className="text-gray-400 text-xs">
                      {expandedUserId === student.userId ? '▲' : '▼'}
                    </span>
                  </button>

                  {expandedUserId === student.userId && (
                    <StudentConceptDrilldown
                      courseId={courseId}
                      userId={student.userId}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Concepts sub-tab */}
      {subTab === 'concepts' && (
        <>
          <p className="text-sm font-semibold text-gray-900 mb-5">Concept breakdown</p>
          <ConceptBreakdownSection concepts={conceptBreakdown} />
        </>
      )}

      {/* Exercises sub-tab */}
      {subTab === 'exercises' && (
        <>
          <p className="text-sm font-semibold text-gray-900 mb-5">Exercise analysis</p>
          <ExerciseAnalysisSection courseId={courseId} />
        </>
      )}
    </div>
  )
}
