# Dynamic Timeline Scaling for Analytics Chart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the exercise-attempts chart in the teacher analytics tab automatically pick hourly, daily, or weekly x-axis buckets based on the actual time span of the data.

**Architecture:** The backend computes the span of exercise attempt timestamps with a pre-flight range query, picks a granularity (`hour` | `day` | `week`) using thresholds (< 48 h → hour, < 720 h → day, else week), then returns bucketed data and the chosen granularity. The frontend branches its tick and tooltip formatters on that value.

**Tech Stack:** Node.js + Express + Prisma raw SQL (PostgreSQL `DATE_TRUNC`), Vitest, Next.js + Recharts, TypeScript.

---

## File Map

| File | Change |
|------|--------|
| `packages/types/src/index.ts` | Add `granularity` to `GetCourseAnalyticsResponse`; update `date` comment |
| `apps/api/src/lib/analytics.ts` | Add `pickGranularity` pure function |
| `apps/api/src/lib/analytics.test.ts` | Tests for `pickGranularity` |
| `apps/api/src/routes/courses.ts` | Range query + dynamic `DATE_TRUNC` + include `granularity` in response |
| `apps/web/src/app/teacher/courses/[id]/AnalyticsTab.tsx` | `granularity` state, formatter branching in `AttemptsChart` |

---

### Task 1: Update shared types

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Update `AttemptsOverTimePoint` and `GetCourseAnalyticsResponse`**

Replace lines 289–298 in `packages/types/src/index.ts`:

```typescript
export type AttemptsOverTimePoint = {
  date: string    // ISO 8601 timestamp (e.g. "2026-04-04T10:00:00.000Z")
  correct: number
  incorrect: number
  total: number
}

export type GetCourseAnalyticsResponse = {
  students: CourseAnalyticsStudent[]
  attemptsOverTime: AttemptsOverTimePoint[]
  granularity: 'hour' | 'day' | 'week'
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from repo root:
```bash
pnpm --filter @metis/types tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): add granularity to GetCourseAnalyticsResponse"
```

---

### Task 2: Add and test `pickGranularity`

**Files:**
- Modify: `apps/api/src/lib/analytics.ts`
- Modify: `apps/api/src/lib/analytics.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/lib/analytics.test.ts`:

```typescript
import { pickGranularity } from './analytics'

describe('pickGranularity', () => {
  it('returns day when both dates are null', () => {
    expect(pickGranularity(null, null)).toBe('day')
  })

  it('returns hour for a span under 48 hours', () => {
    const min = new Date('2026-04-04T08:00:00Z')
    const max = new Date('2026-04-04T18:00:00Z') // 10 h
    expect(pickGranularity(min, max)).toBe('hour')
  })

  it('returns hour for a span just under the 48-hour threshold', () => {
    const min = new Date('2026-04-04T00:00:00Z')
    const max = new Date('2026-04-05T23:59:59Z') // ~47.99 h
    expect(pickGranularity(min, max)).toBe('hour')
  })

  it('returns day for a span of exactly 48 hours', () => {
    const min = new Date('2026-04-04T00:00:00Z')
    const max = new Date('2026-04-06T00:00:00Z') // 48 h exactly
    expect(pickGranularity(min, max)).toBe('day')
  })

  it('returns day for a span between 48 hours and 30 days', () => {
    const min = new Date('2026-04-01T00:00:00Z')
    const max = new Date('2026-04-10T00:00:00Z') // 9 days
    expect(pickGranularity(min, max)).toBe('day')
  })

  it('returns week for a span over 30 days', () => {
    const min = new Date('2026-01-01T00:00:00Z')
    const max = new Date('2026-04-04T00:00:00Z') // ~93 days
    expect(pickGranularity(min, max)).toBe('week')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/api && pnpm vitest run src/lib/analytics.test.ts
```
Expected: 6 failures mentioning `pickGranularity is not a function` (or similar).

- [ ] **Step 3: Implement `pickGranularity` in `apps/api/src/lib/analytics.ts`**

Append to the end of the file:

```typescript
/**
 * Chooses the time bucketing granularity for the analytics chart based on the
 * span between the earliest and latest exercise attempt.
 *
 * Thresholds:
 *   span < 48 h  → 'hour'
 *   span < 720 h → 'day'  (30 days)
 *   otherwise    → 'week'
 */
export function pickGranularity(
  minDate: Date | null,
  maxDate: Date | null
): 'hour' | 'day' | 'week' {
  if (!minDate || !maxDate) return 'day'
  const spanHours = (maxDate.getTime() - minDate.getTime()) / 3_600_000
  if (spanHours < 48) return 'hour'
  if (spanHours < 720) return 'day'
  return 'week'
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd apps/api && pnpm vitest run src/lib/analytics.test.ts
```
Expected: all tests pass (including pre-existing `computeProgress` and `latestSession` tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/analytics.ts apps/api/src/lib/analytics.test.ts
git commit -m "feat(api): add pickGranularity helper with tests"
```

---

### Task 3: Update the analytics API endpoint

**Files:**
- Modify: `apps/api/src/routes/courses.ts`

- [ ] **Step 1: Import `pickGranularity`**

At the top of `apps/api/src/routes/courses.ts`, find the analytics imports line and add `pickGranularity`:

```typescript
import { computeProgress, latestSession, pickGranularity } from '../lib/analytics'
```

- [ ] **Step 2: Update the early-return for courses with no enrolled students (line 341)**

Change:
```typescript
res.json({ students: [], attemptsOverTime: [] } satisfies GetCourseAnalyticsResponse)
```
To:
```typescript
res.json({ students: [], attemptsOverTime: [], granularity: 'day' } satisfies GetCourseAnalyticsResponse)
```

- [ ] **Step 3: Add the range query and granularity selection before the `Promise.all`**

Insert this block immediately before the `// Round 2` comment (before the existing `const [progressRows, sessionRows, attemptRows]` line):

```typescript
// Pre-flight: determine the time span so we can pick the right bucketing granularity
const [rangeRow] = await prisma.$queryRaw<{ min: Date | null; max: Date | null }[]>`
  SELECT MIN("createdAt") AS min, MAX("createdAt") AS max
  FROM "ExerciseAttempt"
  WHERE "courseId" = ${courseId}
`
const granularity = pickGranularity(rangeRow.min, rangeRow.max)
```

- [ ] **Step 4: Replace the existing raw attempt query inside `Promise.all`**

Replace lines 363–373 (the `prisma.$queryRaw` block that groups by `DATE("createdAt")`) with:

```typescript
prisma.$queryRaw<{ date: Date; correct: bigint; incorrect: bigint; total: bigint }[]>`
  SELECT
    DATE_TRUNC(${granularity}, "createdAt") AS date,
    COUNT(*) FILTER (WHERE "isCorrect" = true)  AS correct,
    COUNT(*) FILTER (WHERE "isCorrect" = false) AS incorrect,
    COUNT(*)                                     AS total
  FROM "ExerciseAttempt"
  WHERE "courseId" = ${courseId}
  GROUP BY DATE_TRUNC(${granularity}, "createdAt")
  ORDER BY DATE_TRUNC(${granularity}, "createdAt") ASC
`,
```

Note: `DATE_TRUNC` returns a `Date` (not a string), so the type changes from `{ date: string; ... }` to `{ date: Date; ... }`.

- [ ] **Step 5: Update the response transform to use `.toISOString()` and include `granularity`**

Replace lines 402–410 (the `result` construction block):

```typescript
const result: GetCourseAnalyticsResponse = {
  students,
  granularity,
  attemptsOverTime: attemptRows.map(r => ({
    date:      (r.date as Date).toISOString(),
    correct:   Number(r.correct),
    incorrect: Number(r.incorrect),
    total:     Number(r.total),
  })),
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd apps/api && pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/courses.ts
git commit -m "feat(api): dynamic granularity for analytics attempts-over-time query"
```

---

### Task 4: Update the frontend chart

**Files:**
- Modify: `apps/web/src/app/teacher/courses/[id]/AnalyticsTab.tsx`

- [ ] **Step 1: Update `AttemptsChart` to accept and use `granularity`**

Replace the entire `AttemptsChart` function (lines 56–100) with:

```typescript
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

  function formatLabel(d: string): string {
    const date = new Date(d)
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
```

- [ ] **Step 2: Add `granularity` state to `AnalyticsTab`**

In `AnalyticsTab` (line 106+), add the state variable alongside the existing state declarations:

```typescript
const [granularity, setGranularity] = useState<'hour' | 'day' | 'week'>('day')
```

- [ ] **Step 3: Set granularity from API response**

Inside the `load` function, after `setAttemptsOverTime(data.attemptsOverTime)`, add:

```typescript
setGranularity(data.granularity)
```

- [ ] **Step 4: Pass `granularity` to `AttemptsChart`**

Find the line:
```typescript
<AttemptsChart data={attemptsOverTime} />
```
Replace with:
```typescript
<AttemptsChart data={attemptsOverTime} granularity={granularity} />
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd apps/web && pnpm tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/teacher/courses/[id]/AnalyticsTab.tsx
git commit -m "feat(web): dynamic x-axis formatting for analytics chart based on granularity"
```

---

## Verification

1. Start the dev servers (`pnpm dev` from repo root).
2. Open a course analytics tab that has exercise attempts only from the past few hours — confirm x-axis shows labels like "Apr 4, 10 AM".
3. Open a course with attempts spread over several days (> 48 h, < 30 days) — confirm x-axis shows "Apr 4", "Apr 5" etc.
4. Open a course with attempts over > 30 days — confirm x-axis shows week-start dates and tooltip says "Week of April 4, 2026".
5. Open a course with no attempts — confirm the empty-state message appears with no errors.
6. Run all API tests: `cd apps/api && pnpm vitest run` — all tests pass.
