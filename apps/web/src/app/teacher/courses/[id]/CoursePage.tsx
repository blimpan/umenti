'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CourseDetail, CourseStatus } from '@metis/types'
import { apiFetch } from '@/lib/api'
import OverviewTab from './OverviewTab'
import ContentTab from './ContentTab'
import AnalyticsTab from './AnalyticsTab'
import SettingsModal from './SettingsModal'

type Tab = 'overview' | 'content' | 'analytics'

const STATUS_STYLES: Record<CourseStatus, string> = {
  GENERATING: 'bg-blue-50 text-blue-600',
  FAILED:     'bg-red-50 text-red-600',
  DRAFT:      'bg-yellow-50 text-yellow-700',
  PUBLISHED:  'bg-green-50 text-green-700',
  UNPUBLISHED:'bg-orange-50 text-orange-700',
  ARCHIVED:   'bg-gray-100 text-gray-500',
}

export default function CoursePage({ course }: { course: CourseDetail }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(
    course.modules[0]?.id ?? null
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [localApprovedIds, setLocalApprovedIds] = useState<Set<number>>(
    () => new Set(course.modules.filter((m) => m.reviewStatus === 'APPROVED').map((m) => m.id))
  )
  const [pendingApprovals, setPendingApprovals] = useState(0)

  const effectiveCourse = {
    ...course,
    modules: course.modules.map((m) =>
      localApprovedIds.has(m.id) ? { ...m, reviewStatus: 'APPROVED' as const } : m
    ),
  }

  function handleModuleApproved(moduleId: number) {
    setLocalApprovedIds((prev) => new Set([...prev, moduleId]))
  }

  const isFullBleed = activeTab === 'content'

  const openModule = (moduleId: number) => {
    setSelectedModuleId(moduleId)
    setActiveTab('content')
  }

  async function publishCourse() {
    setPublishing(true)
    const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses/${course.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    })
    setPublishing(false)
    if (res.ok) router.refresh()
    else if (res.status === 422) alert('All modules must be approved before publishing.')
  }

  return (
    <div className={isFullBleed ? 'flex flex-col h-screen overflow-hidden' : 'p-8'}>
      {/* Header */}
      <header
        className={`flex items-center justify-between gap-4 ${
          isFullBleed ? 'px-8 pt-8 pb-6 bg-white shrink-0' : 'mb-6'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/teacher/courses"
            className="text-sm text-gray-400 hover:text-gray-600 shrink-0 transition-colors"
          >
            ← My courses
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-semibold text-gray-900 truncate">{course.name}</h1>
          <span
            className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[course.status]}`}
          >
            {course.status.toLowerCase()}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Settings
          </button>
          {course.status === 'DRAFT' && (
            <button
              onClick={publishCourse}
              disabled={publishing || pendingApprovals > 0 || effectiveCourse.modules.some((m) => m.reviewStatus !== 'APPROVED')}
              className="text-sm font-medium bg-primary text-white px-4 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
          )}
        </div>
      </header>

      {/* Tab bar */}
      <div
        className={`flex border-b mb-8 ${isFullBleed ? 'px-8 bg-white shrink-0' : ''}`}
      >
        {(['overview', 'content', 'analytics'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab course={effectiveCourse} onOpenModule={openModule} />
      )}
      {activeTab === 'content' && (
        <ContentTab
          course={effectiveCourse}
          selectedModuleId={selectedModuleId}
          onSelectModule={setSelectedModuleId}
          onModuleApproved={handleModuleApproved}
          onApprovalStart={() => setPendingApprovals((n) => n + 1)}
          onApprovalEnd={() => setPendingApprovals((n) => n - 1)}
        />
      )}
      {activeTab === 'analytics' && (
        <AnalyticsTab courseId={course.id} />
      )}

      {settingsOpen && (
        <SettingsModal course={course} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  )
}
