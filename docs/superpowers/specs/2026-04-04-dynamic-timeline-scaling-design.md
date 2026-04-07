# Dynamic Timeline Scaling for Analytics Chart

**Date:** 2026-04-04
**Status:** Approved

## Context

The teacher analytics tab shows a line chart of exercise attempts over time. The x-axis previously used a fixed "Month Day" format with daily buckets regardless of how much data existed. For a new course with only a few hours of activity, this meant a single data point with no useful temporal resolution. The goal is to make the chart automatically choose a granularity — hourly, daily, or weekly — based on the actual span of data, so the chart is always informative.

## Approach

Backend determines granularity based on the time span between the earliest and latest exercise attempt. The chosen granularity is returned alongside the data so the frontend can format axis labels accordingly. No frontend-driven granularity selection; no client-side aggregation.

## Thresholds

| Span | Granularity |
|------|-------------|
| < 48 hours | `hour` |
| < 720 hours (30 days) | `day` |
| ≥ 720 hours | `week` |

## Data Shape Changes

**`packages/types/src/index.ts`**

- `AttemptsOverTimePoint.date` stays `string` but is now always a full ISO timestamp (`2026-04-04T10:00:00Z`) for all granularities, so `new Date(date)` works uniformly.
- Add `granularity: 'hour' | 'day' | 'week'` to `GetCourseAnalyticsResponse`.

## Backend Changes

**`apps/api/src/routes/courses.ts`** — analytics endpoint

1. Before the existing `Promise.all`, run a range query:
   ```sql
   SELECT MIN("createdAt") AS min, MAX("createdAt") AS max
   FROM "ExerciseAttempt" WHERE "courseId" = $courseId
   ```
2. Compute `spanHours = (max - min) / 3_600_000` in Node.js and pick granularity per thresholds above.
3. Edge case: zero attempts → skip range query, return `granularity: 'day'` with empty array.
4. Replace `DATE("createdAt")` grouping in the existing raw query with `DATE_TRUNC($granularity, "createdAt")`, casting the result to an ISO string.
5. Include `granularity` in the response object.

## Frontend Changes

**`apps/web/src/app/teacher/courses/[id]/AnalyticsTab.tsx`**

- Store `granularity` from the API response in state alongside `attemptsOverTime`.
- Pass `granularity` as a prop to `AttemptsChart`.
- Replace the hardcoded `tickFormatter` and `labelFormatter` with a branch on granularity:

| Granularity | Tick label | Tooltip label |
|---|---|---|
| `hour` | "Apr 4, 10 AM" | "April 4, 2026 10:00 AM" |
| `day` | "Apr 4" | "April 4, 2026" |
| `week` | "Apr 4" (week start) | "Week of April 4, 2026" |

No changes to line series, grid, legend, or chart dimensions.

## Files to Modify

- `packages/types/src/index.ts` — type changes
- `apps/api/src/routes/courses.ts` — range query + dynamic DATE_TRUNC
- `apps/web/src/app/teacher/courses/[id]/AnalyticsTab.tsx` — formatter branching

## Verification

1. Run the dev server and open a course analytics tab.
2. Course with < 48h of data: x-axis shows hours (e.g. "Apr 4, 10 AM").
3. Course with a few weeks of data: x-axis shows days (e.g. "Apr 4").
4. Course with > 30 days of data: x-axis shows week starts (e.g. "Apr 4").
5. Course with zero attempts: chart shows empty state, no errors.
6. TypeScript compiles without errors (`pnpm tsc --noEmit`).
