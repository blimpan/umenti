'use client'

import { createContext, useCallback, useContext, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import type { GetCoursesResponse, CourseStatus } from '@metis/types'

const POLL_INTERVAL_MS = 10_000
const TOAST_DURATION_MS = 7_000

// ─── Context ─────────────────────────────────────────────────────────────────

const GenerationPollerContext = createContext<{ wakePoller: () => void }>({
  wakePoller: () => {},
})

export function useGenerationPoller() {
  return useContext(GenerationPollerContext)
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GenerationPollerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // Keep pathname current inside the interval closure without restarting the effect.
  const pathnameRef = useRef(pathname)
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  // Tracks last-known status for every course seen this session.
  const knownStatuses = useRef<Map<number, CourseStatus>>(new Map())

  // Holds a reference to startPolling so wakePoller (context value) can call it
  // from outside the effect without capturing a stale closure.
  const startPollingRef = useRef<(() => void) | null>(null)

  // Stable context value — reads from startPollingRef so it never changes identity.
  const wakePoller = useCallback(() => {
    startPollingRef.current?.()
  }, [])

  useEffect(() => {
    const intervalId = { current: null as ReturnType<typeof setInterval> | null }

    function stopPolling() {
      if (intervalId.current !== null) {
        clearInterval(intervalId.current)
        intervalId.current = null
      }
    }

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
      // is on the courses list — avoids disrupting other pages mid-interaction.
      if (anyTransition && pathnameRef.current === '/teacher/courses') {
        router.refresh()
      }

      // Stop polling once nothing is generating — wakePoller() restarts it.
      const anyGenerating = [...knownStatuses.current.values()].some(
        (s) => s === 'GENERATING',
      )
      if (!anyGenerating) {
        stopPolling()
      }
    }

    function startPolling() {
      stopPolling() // prevent double-start if wakePoller called while already running
      void tick()
      intervalId.current = setInterval(() => void tick(), POLL_INTERVAL_MS)
    }

    // Register so wakePoller() can call this from outside the effect.
    startPollingRef.current = startPolling

    // Fire immediately on mount — there may already be GENERATING courses.
    startPolling()

    return () => {
      stopPolling()
      startPollingRef.current = null
    }
  }, [router]) // router is stable; no other deps — see pathnameRef above

  return (
    <GenerationPollerContext.Provider value={{ wakePoller }}>
      {children}
    </GenerationPollerContext.Provider>
  )
}
