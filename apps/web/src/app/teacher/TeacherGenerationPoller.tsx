'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import type { GetCoursesResponse, CourseStatus } from '@metis/types'

const POLL_INTERVAL_MS = 3_000
const TOAST_DURATION_MS = 7_000

export function TeacherGenerationPoller() {
  const router = useRouter()
  const pathname = usePathname()

  // Keep pathname current inside the interval closure without restarting the effect.
  // If pathname were in the useEffect dep array, the interval would restart on every
  // navigation, resetting knownStatuses and potentially re-firing toasts.
  const pathnameRef = useRef(pathname)
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  // Tracks last-known status for every course seen this session.
  // A ref rather than state because updates should not cause re-renders.
  const knownStatuses = useRef<Map<number, CourseStatus>>(new Map())

  useEffect(() => {
    async function tick() {
      let courses: GetCoursesResponse
      try {
        const res = await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        courses = await res.json()
      } catch {
        return // transient network error — skip this tick, try again next
      }

      let anyTransition = false

      for (const course of courses) {
        const prev = knownStatuses.current.get(course.id)

        if (prev === undefined) {
          // First time we've seen this course — record its status, no toast
          knownStatuses.current.set(course.id, course.status)
          continue
        }

        if (prev === 'GENERATING') {
          if (course.status === 'DRAFT') {
            toast.success(`"${course.name}" is ready for review`, { duration: TOAST_DURATION_MS })
            knownStatuses.current.set(course.id, course.status)
            anyTransition = true
          } else if (course.status === 'FAILED') {
            toast.error(`"${course.name}" generation failed`, { duration: TOAST_DURATION_MS })
            knownStatuses.current.set(course.id, course.status)
            anyTransition = true
          }
          // Still GENERATING — no update needed
        } else if (prev !== course.status) {
          // Status changed for a non-GENERATING reason (e.g. teacher published) — update silently
          knownStatuses.current.set(course.id, course.status)
        }
      }

      // Only refresh the Server Component if a transition happened AND the teacher
      // is on the courses list — avoids disrupting other pages mid-interaction
      if (anyTransition && pathnameRef.current === '/teacher/courses') {
        router.refresh()
      }
    }

    // Guard against a late-resolving fetch firing after cleanup
    let stopped = false

    async function runTick() {
      if (stopped) return
      await tick()
    }

    // Fire immediately on mount so we don't wait 3s for the first check
    void runTick()
    const intervalId = setInterval(runTick, POLL_INTERVAL_MS)

    return () => {
      stopped = true
      clearInterval(intervalId)
    }
  }, [router]) // router is stable; no other deps — see pathnameRef above

  return null
}
