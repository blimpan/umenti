# Analytics Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sortable Analytics tab to the teacher course page showing enrolled students' course progress and last module activity.

**Architecture:** Pure computation helpers extracted to `lib/analytics.ts` and tested in isolation. A new `GET /api/courses/:id/analytics` handler in `courses.ts` fetches all data in two parallel-optimised Prisma rounds. A new `AnalyticsTab` client component fetches lazily when the tab is first clicked, following the same pattern as `StudentsSection`.

**Tech Stack:** Express + Prisma (backend), Vitest (tests), Next.js client component + Tailwind (frontend), shared types in `packages/types`.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `packages/types/src/index.ts` | Add `CourseAnalyticsStudent`, `GetCourseAnalyticsResponse` |
| Create | `apps/api/src/lib/analytics.ts` | Pure helpers: `computeProgress`, `latestSession` |
| Create | `apps/api/src/lib/analytics.test.ts` | Vitest unit tests for the helpers |
| Modify | `apps/api/src/routes/courses.ts` | Add `GET /:id/analytics` route handler |
| Create | `apps/web/src/app/teacher/courses/[id]/AnalyticsTab.tsx` | Client component: fetch + sortable table |
| Modify | `apps/web/src/app/teacher/courses/[id]/CoursePage.tsx` | Wire in the Analytics tab |

---

## Task 1: Add shared types

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Append the new types**

Open `packages/types/src/index.ts` and add at the bottom, before the closing of the file:

```ts
// --- Teacher analytics ---

export interface CourseAnalyticsStudent {
  email: string
  progress: number | null  // decay-weighted 0–100 average; null = student has not started any concept
  lastActiveAt: string | null  // ISO 8601 string; null = student has never opened a module
}

export type GetCourseAnalyticsResponse = CourseAnalyticsStudent[]
```

---

## Task 2: Analytics computation helpers (TDD)

**Files:**
- Create: `apps/api/src/lib/analytics.ts`
- Create: `apps/api/src/lib/analytics.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/lib/analytics.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeProgress, latestSession } from './analytics'

describe('computeProgress', () => {
  it('returns null when the student has no concept progress rows', () => {
    expect(computeProgress([])).toBeNull()
  })

  it('returns the average decay-applied score when rows exist', () => {
    const now = new Date()
    // Both rows have lastActivityAt = now, so no decay is applied.
    // Average of 80 and 60 = 70.
    const result = computeProgress([
      { score: 80, lastActivityAt: now },
      { score: 60, lastActivityAt: now },
    ])
    expect(result).toBeCloseTo(70, 1)
  })

  it('applies decay — a score touched long ago is lower than raw', () => {
    // Use a date 100 weeks ago to force meaningful decay.
    const longAgo = new Date(Date.now() - 100 * 7 * 24 * 60 * 60 * 1000)
    const result = computeProgress([{ score: 100, lastActivityAt: longAgo }])
    // 0.9^100 ≈ 0.0000265 → effective score ≈ 0.00265, well below 100
    expect(result!).toBeLessThan(1)
  })
})

describe('latestSession', () => {
  it('returns null when the student has no sessions', () => {
    expect(latestSession([])).toBeNull()
  })

  it('returns the most recent updatedAt as an ISO string', () => {
    const older = new Date('2026-03-01T10:00:00.000Z')
    const newer = new Date('2026-04-01T10:00:00.000Z')
    expect(latestSession([{ updatedAt: older }, { updatedAt: newer }])).toBe(
      newer.toISOString()
    )
  })

  it('handles a single session', () => {
    const ts = new Date('2026-04-04T08:00:00.000Z')
    expect(latestSession([{ updatedAt: ts }])).toBe(ts.toISOString())
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/api && pnpm vitest run src/lib/analytics.test.ts
```

Expected: FAIL — `Cannot find module './analytics'`

- [ ] **Step 3: Implement the helpers**

Create `apps/api/src/lib/analytics.ts`:

```ts
import { applyDecay } from './decay'

/**
 * Computes the decay-weighted average progress score for one student across a
 * set of concept progress rows. Returns null if the student has no rows (i.e.
 * they have not started any concept in the course).
 */
export function computeProgress(
  rows: { score: number; lastActivityAt: Date }[]
): number | null {
  if (rows.length === 0) return null
  const scores = rows.map(r => applyDecay(r.score, r.lastActivityAt))
  return scores.reduce((a, b) => a + b, 0) / scores.length
}

/**
 * Returns the most recent ModuleSession updatedAt as an ISO string, or null if
 * the student has no sessions (i.e. they have never opened a module).
 */
export function latestSession(
  sessions: { updatedAt: Date }[]
): string | null {
  if (sessions.length === 0) return null
  return sessions
    .reduce((latest, s) => (s.updatedAt > latest.updatedAt ? s : latest))
    .updatedAt.toISOString()
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd apps/api && pnpm vitest run src/lib/analytics.test.ts
```

Expected: All 6 tests PASS.

---

## Task 3: Backend route handler

**Files:**
- Modify: `apps/api/src/routes/courses.ts`

- [ ] **Step 1: Add the import**

At the top of `apps/api/src/routes/courses.ts`, add to the existing imports:

```ts
import { computeProgress, latestSession } from '../lib/analytics'
import { GetCourseAnalyticsResponse } from '@metis/types'
```

The `GetCourseAnalyticsResponse` import goes in the existing `@metis/types` import line:

```ts
import { CourseWizardInput, CourseListItem, CourseDetail, ReviewStatus, CourseConcept, CourseExercise, GetCourseAnalyticsResponse } from '@metis/types'
```

- [ ] **Step 2: Add the route handler**

Add the following handler to `apps/api/src/routes/courses.ts`, just before `router.delete('/:id', ...)`:

```ts
// GET /api/courses/:id/analytics — teacher fetches per-student progress for a course
router.get('/:id/analytics', requireAuth, async (req, res) => {
  const courseId = parseInt(req.params.id as string)
  if (isNaN(courseId)) { res.status(400).json({ error: 'Invalid course ID' }); return }

  try {
    // Verify the course exists and belongs to this teacher
    const course = await prisma.course.findFirst({
      where: { id: courseId, teacherId: req.user!.id },
      select: { id: true },
    })
    if (!course) { res.status(404).json({ error: 'Course not found' }); return }

    // Round 1 — enrolled students
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId, status: 'ACTIVE' },
      select: {
        userId: true,
        student: { select: { user: { select: { email: true } } } },
      },
    })

    if (enrollments.length === 0) {
      res.json([] as GetCourseAnalyticsResponse)
      return
    }

    const userIds = enrollments.map(e => e.userId!)

    // Round 2 — progress and sessions in parallel, scoped to this course
    const [progressRows, sessionRows] = await Promise.all([
      prisma.studentConceptProgress.findMany({
        where: {
          userId: { in: userIds },
          concept: { courseId },
        },
        select: { userId: true, score: true, lastActivityAt: true },
      }),
      prisma.moduleSession.findMany({
        where: {
          userId: { in: userIds },
          module: { courseId },
        },
        select: { userId: true, updatedAt: true },
      }),
    ])

    // Group rows by userId for O(n) lookup
    const progressByUser = new Map<string, { score: number; lastActivityAt: Date }[]>()
    for (const row of progressRows) {
      if (!progressByUser.has(row.userId)) progressByUser.set(row.userId, [])
      progressByUser.get(row.userId)!.push({ score: row.score, lastActivityAt: row.lastActivityAt })
    }

    const sessionsByUser = new Map<string, { updatedAt: Date }[]>()
    for (const row of sessionRows) {
      if (!sessionsByUser.has(row.userId)) sessionsByUser.set(row.userId, [])
      sessionsByUser.get(row.userId)!.push({ updatedAt: row.updatedAt })
    }

    const result: GetCourseAnalyticsResponse = enrollments
      .map(e => ({
        email: e.student!.user.email,
        progress: computeProgress(progressByUser.get(e.userId!) ?? []),
        lastActiveAt: latestSession(sessionsByUser.get(e.userId!) ?? []),
      }))
      // Default sort: most recently active first; nulls last
      .sort((a, b) => {
        const av = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0
        const bv = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0
        return bv - av
      })

    res.json(result)
  } catch (err) {
    console.error('[GET /api/courses/:id/analytics]', err)
    res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})
```

- [ ] **Step 3: Verify the API compiles**

```bash
cd apps/api && pnpm tsc --noEmit
```

Expected: No errors.

---

## Task 4: AnalyticsTab frontend component

**Files:**
- Create: `apps/web/src/app/teacher/courses/[id]/AnalyticsTab.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/app/teacher/courses/[id]/AnalyticsTab.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CourseAnalyticsStudent, GetCourseAnalyticsResponse } from '@metis/types'

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
      // Nulls sort last regardless of direction
      if (a.progress === null && b.progress === null) return 0
      if (a.progress === null) return 1
      if (b.progress === null) return -1
      cmp = a.progress - b.progress
    } else {
      // lastActiveAt — nulls sort last regardless of direction
      if (!a.lastActiveAt && !b.lastActiveAt) return 0
      if (!a.lastActiveAt) return 1
      if (!b.lastActiveAt) return -1
      cmp = new Date(a.lastActiveAt).getTime() - new Date(b.lastActiveAt).getTime()
    }
    return sortDir === 'asc' ? cmp : -cmp
  })
}

interface Props {
  courseId: number
}

export default function AnalyticsTab({ courseId }: Props) {
  const [students, setStudents] = useState<CourseAnalyticsStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortKey>('lastActiveAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await createClient().auth.getSession()
        const res = await fetch(`${API}/api/courses/${courseId}/analytics`, {
          headers: { Authorization: `Bearer ${session!.access_token}` },
        })
        if (!res.ok) throw new Error('Failed to load analytics')
        const data: GetCourseAnalyticsResponse = await res.json()
        setStudents(data)
      } catch {
        setError('Could not load student analytics. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [courseId])

  function handleSort(key: SortKey) {
    if (key === sortBy) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  const sorted = sortStudents(students, sortBy, sortDir)

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (col !== sortBy) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-primary ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>
  }

  if (students.length === 0) {
    return <p className="text-sm text-gray-400">No students enrolled in this course yet.</p>
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-5">
        <p className="text-sm font-semibold text-gray-900">Student progress</p>
        <p className="text-sm text-gray-400">{students.length} student{students.length !== 1 ? 's' : ''} enrolled</p>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_100px_140px] bg-gray-50 border-b border-gray-200 px-4 py-2">
          {(
            [
              { key: 'email' as SortKey, label: 'Student' },
              { key: 'progress' as SortKey, label: 'Progress' },
              { key: 'lastActiveAt' as SortKey, label: 'Last active' },
            ] as { key: SortKey; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleSort(key)}
              className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600 transition-colors flex items-center"
            >
              {label}
              <SortIcon col={key} />
            </button>
          ))}
        </div>

        {/* Rows */}
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
    </div>
  )
}
```

- [ ] **Step 2: Verify the component compiles**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: No errors.

---

## Task 5: Wire the Analytics tab into CoursePage

**Files:**
- Modify: `apps/web/src/app/teacher/courses/[id]/CoursePage.tsx`

- [ ] **Step 1: Add the import**

At the top of `CoursePage.tsx`, add:

```ts
import AnalyticsTab from './AnalyticsTab'
```

- [ ] **Step 2: Extend the Tab type**

Change:

```ts
type Tab = 'overview' | 'content'
```

To:

```ts
type Tab = 'overview' | 'content' | 'analytics'
```

- [ ] **Step 3: Add the tab button**

In the tab bar map, change:

```tsx
{(['overview', 'content'] as Tab[]).map((tab) => (
```

To:

```tsx
{(['overview', 'content', 'analytics'] as Tab[]).map((tab) => (
```

- [ ] **Step 4: Render the tab content**

After the existing `{activeTab === 'content' && ...}` block, add:

```tsx
{activeTab === 'analytics' && (
  <AnalyticsTab courseId={course.id} />
)}
```

- [ ] **Step 5: Verify the full frontend compiles**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Smoke test in the browser**

Start the dev servers and open a published course as a teacher. Verify:
- "Analytics" tab appears in the tab bar
- Clicking it shows a loading skeleton, then the student table
- Table is sortable by all three columns
- Students who have never started show "—" for progress and "Never" for last active
- Sort defaults to last active descending
