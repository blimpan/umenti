# Analytics Tab Design

**Date:** 2026-04-04
**Status:** Approved

## Summary

Add an Analytics tab to the teacher's course page. The tab shows a sortable table of enrolled students with their overall course progress and last activity time. This is the first analytics surface; per-exercise and class-wide aggregations are future work.

---

## Scope

**In scope:**
- New `GET /api/courses/:id/analytics` endpoint (teacher-only)
- `CourseAnalyticsStudent` type in `packages/types`
- `AnalyticsTab` client component in `apps/web`
- Third tab ("Analytics") wired into `CoursePage`

**Out of scope (future):**
- Per-exercise pass/fail rates
- Class-wide aggregated concept analytics
- Student name and avatar (email used for now)
- Progress breakdown per module

---

## Data Model

No schema changes required. The feature reads from existing tables:

| Table | Fields used |
|---|---|
| `Enrollment` | `courseId`, `userId`, `status = 'ACTIVE'` |
| `User` | `email` (via `Enrollment → student → user`) |
| `StudentConceptProgress` | `userId`, `score`, `lastActivityAt` (scoped to `concept.courseId`) |
| `ModuleSession` | `userId`, `updatedAt` (scoped to `module.courseId`) |

**Progress** is the decay-weighted average score across all concepts in the course for a given student, using the existing `applyDecay` function. A student with no `StudentConceptProgress` rows has `progress: null` (not started).

**Last active** is the most recent `ModuleSession.updatedAt` across all modules in the course for a given student. `null` if the student has never opened a module.

---

## API

### `GET /api/courses/:id/analytics`

**Auth:** `requireAuth`. The requesting user must be the teacher of the course (verified via `course.teacherId === req.user!.id`). Returns 403 otherwise.

**Query strategy — 2 rounds, second round parallel:**

```
Round 1:  Fetch ACTIVE enrollments for courseId, include user email
Round 2:  Promise.all([
            StudentConceptProgress — userId IN enrolledIds, concept.courseId = courseId
            ModuleSession          — userId IN enrolledIds, module.courseId = courseId
          ])
```

Both round-2 queries hit indexed columns. Progress and last active are computed in memory. Three Prisma queries total.

**Response shape:**
```ts
CourseAnalyticsStudent[]
```

Sorted by `lastActiveAt` descending server-side (nulls last). The frontend can re-sort client-side.

**Error responses:**
- `400` — invalid course ID
- `404` — course not found or requester is not the course's teacher (404 rather than 403 to avoid confirming that a course ID exists to unauthorised callers)
- `500` — query failure

---

## Shared Types (`packages/types`)

```ts
export interface CourseAnalyticsStudent {
  email: string
  progress: number | null   // decay-weighted 0–100, null = not started
  lastActiveAt: string | null  // ISO 8601, null = never opened a module
}

export type GetCourseAnalyticsResponse = CourseAnalyticsStudent[]
```

---

## Frontend

### `CoursePage.tsx`

- Extend `Tab` union: `'overview' | 'content' | 'analytics'`
- Add "Analytics" tab button to the tab bar
- Render `<AnalyticsTab courseId={course.id} />` when `activeTab === 'analytics'`

### `AnalyticsTab.tsx` (new client component)

**Location:** `apps/web/src/app/teacher/courses/[id]/AnalyticsTab.tsx`

**Behaviour:**
- Fetches `GET /api/courses/:id/analytics` on mount (once per tab activation)
- Shows a loading skeleton while fetching
- Shows an error message on failure

**Table columns:**

| Column | Value | Sort |
|---|---|---|
| Student | `email` | Alphabetical |
| Progress | `progress ?? '—'` with `%` suffix when not null | Numeric |
| Last active | See formatting rules below | Chronological |

**Last active formatting:**
- `null` → `"Never"`
- Within 24h → relative (`"32 min ago"`, `"5h ago"`)
- ≥24h ago → short calendar date (`"Apr 3"`, `"Mar 29"`)

**Sorting:**
- Default: last active descending (nulls at bottom)
- Clicking an active sort column toggles direction
- Clicking an inactive column sorts by that column descending

**Empty states:**
- No students enrolled yet: `"No students enrolled in this course yet."`
- All students enrolled but none have started: table renders normally (progress `—`, last active `"Never"`)

**Progress display:** Plain number with `%` suffix. No color coding. `null` renders as `—`.

---

## File Checklist

```
apps/api/src/routes/courses.ts       — add GET /:id/analytics handler
apps/api/src/index.ts                — already registers courses router (no change needed)
packages/types/src/index.ts          — add CourseAnalyticsStudent, GetCourseAnalyticsResponse
apps/web/src/app/teacher/courses/[id]/CoursePage.tsx   — add analytics tab
apps/web/src/app/teacher/courses/[id]/AnalyticsTab.tsx — new file
```
