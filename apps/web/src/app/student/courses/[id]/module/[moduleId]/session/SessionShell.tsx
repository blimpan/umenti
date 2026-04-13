'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { apiFetch } from '@/lib/api'
import {
  ChatMessage,
  CourseConcept,
  StudentCourseModule,
  ExerciseResult,
  GetSessionResponse,
  SseEvent,
  StudentExercise,
} from '@metis/types'
import ExerciseCard from './ExerciseCard'
import VisualizationFrame from '@/components/VisualizationFrame'
import VisualizationRenderer from '@/components/visualizations/VisualizationRenderer'
import type { ConceptVisualization } from '@metis/types'
import MathMarkdown from '@/components/MathMarkdown'
import { RichInput } from '@/components/input/RichInput'
import { RichMessageRenderer } from '@/components/input/RichMessageRenderer'
import type { RichMessage } from '@metis/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  courseId: string
  courseName: string
  currentModule: StudentCourseModule
  allModules: { id: number; name: string; order: number }[]
}

// ---------------------------------------------------------------------------
// Message render components
// ---------------------------------------------------------------------------

function AiMessage({ content }: { content: string }) {
  return (
    <div className="flex gap-3 max-w-2xl">
      <div className="w-7 h-7 rounded-full bg-teal-600 shrink-0 mt-0.5 flex items-center justify-center">
        <span className="text-white text-[11px] font-bold">M</span>
      </div>
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 leading-relaxed md-content">
        <MathMarkdown>{content}</MathMarkdown>
      </div>
    </div>
  )
}

function AiTypingIndicator() {
  return (
    <div className="flex gap-3 max-w-2xl">
      <div className="w-7 h-7 rounded-full bg-teal-600 shrink-0 mt-0.5 flex items-center justify-center">
        <span className="text-white text-[11px] font-bold">M</span>
      </div>
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-1.5">
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400 block" />
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400 block" />
        <span className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400 block" />
      </div>
    </div>
  )
}

function StudentMessage({ content, richContent }: { content: string; richContent?: RichMessage['richContent'] }) {
  return (
    <div className="flex justify-end">
      <div className="bg-gray-900 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-lg leading-relaxed">
        {richContent ? (
          <RichMessageRenderer richContent={richContent} />
        ) : (
          content
        )}
      </div>
    </div>
  )
}

function SystemMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-center py-1">
      <span className="text-[11px] tracking-wide text-gray-400">{content}</span>
    </div>
  )
}

function TheoryBlock({
  blocks,
  visualizations,
  visualization,
}: {
  blocks: string[]
  visualizations: ConceptVisualization[]
  visualization?: string   // legacy fallback
}) {
  return (
    <div
      className="rounded-xl border border-gray-300 bg-white px-5 py-4"
      style={{ boxShadow: '0 4px 0 0 #d1d5db' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Theory</p>
      {blocks.map((block, i) => (
        <div key={i} className="text-sm text-gray-700 leading-relaxed mb-2 md-content last:mb-0">
          <MathMarkdown>{block}</MathMarkdown>
        </div>
      ))}
      {visualizations.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {visualizations.map(viz => (
            <VisualizationRenderer
              key={viz.id}
              templateId={viz.visualizationType}
              params={viz.visualizationParams}
              customHtml={viz.visualization}
            />
          ))}
        </div>
      )}
      {visualizations.length === 0 && visualization && (
        <div className="mt-4">
          <VisualizationRenderer customHtml={visualization} />
        </div>
      )}
    </div>
  )
}

function ConceptMasteryCard({ conceptId: _conceptId, score }: { conceptId: number; score: number }) {
  return (
    <div className="flex justify-center py-2">
      <div className="inline-flex items-center gap-2 bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold px-4 py-2 rounded-full">
        <span className="w-4 h-4 rounded-full bg-teal-600 text-white flex items-center justify-center text-[9px] font-black">✓</span>
        <span>Concept mastered · {Math.round(score)}</span>
      </div>
    </div>
  )
}

function ContinuePrompt({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex justify-center py-2">
      <button
        onClick={onContinue}
        className="text-xs text-gray-400 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50 transition-colors focus:outline-none"
      >
        Press{' '}
        <kbd className="font-mono bg-gray-100 border border-gray-200 px-1 rounded text-gray-500">Space</kbd>
        {' '}or{' '}
        <kbd className="font-mono bg-gray-100 border border-gray-200 px-1 rounded text-gray-500">↵</kbd>
        {' '}to continue
      </button>
    </div>
  )
}

function ModuleEndCard({
  conceptScores,
  nextModuleId,
  courseId,
  conceptNames,
}: {
  conceptScores: { conceptId: number; effectiveScore: number }[]
  nextModuleId?: number
  courseId: string
  conceptNames: Record<number, string>
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
      <p className="font-bold text-gray-900 mb-1">Module complete</p>
      <p className="text-sm text-gray-500 mb-4">
        You&apos;ve worked through all concepts in this module.
      </p>

      {/* Concept score bars */}
      <div className="space-y-2.5 mb-5">
        {conceptScores.map(cs => (
          <div key={cs.conceptId} className="flex items-center gap-3">
            <span className="text-xs text-gray-700 w-40 shrink-0 truncate">
              {conceptNames[cs.conceptId] ?? `Concept ${cs.conceptId}`}
            </span>
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all"
                style={{ width: `${Math.round(cs.effectiveScore)}%` }}
              />
            </div>
            <span className="text-xs font-bold text-gray-400 w-8 text-right shrink-0">
              {Math.round(cs.effectiveScore)}
            </span>
          </div>
        ))}
      </div>

      {nextModuleId ? (
        <Link
          href={`/student/courses/${courseId}/module/${nextModuleId}`}
          className="inline-block bg-teal-600 text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-teal-700 transition-colors"
        >
          Continue to next module →
        </Link>
      ) : (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Course complete!</p>
          <Link
            href={`/student/courses/${courseId}`}
            className="inline-block text-sm text-teal-600 hover:text-teal-800 transition-colors"
          >
            ← Back to course overview
          </Link>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Left icon rail — module navigation chip
// ---------------------------------------------------------------------------

function ModuleChip({
  module,
  isActive,
  courseId,
}: {
  module: { id: number; name: string; order: number }
  isActive: boolean
  courseId: string
}) {
  return (
    <Link
      href={`/student/courses/${courseId}/module/${module.id}/session`}
      title={module.name}
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
        isActive
          ? 'bg-gray-900 text-white'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
      }`}
    >
      {module.order + 1}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Right panel — collapsible concept section in the Theory tab
// Auto-expands and scrolls into view when its concept becomes active.
// ---------------------------------------------------------------------------

function ConceptSection({
  concept,
  isActive,
}: {
  concept: CourseConcept
  isActive: boolean
}) {
  // Start collapsed unless this is the concept the student is currently working on
  const [expanded, setExpanded] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

  // When this concept becomes active (student is working on it), expand it
  useEffect(() => {
    if (isActive) setExpanded(true)
  }, [isActive])

  // Scroll this section into view when it becomes the active concept
  useEffect(() => {
    if (isActive && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isActive])

  return (
    <div ref={sectionRef} className="py-1">
      <button
        onClick={() => setExpanded(e => !e)}
        className={`w-full flex items-center justify-between py-2.5 px-1 text-left group rounded-lg transition-colors ${
          isActive ? 'bg-teal-50' : 'hover:bg-gray-50'
        }`}
      >
        <span className={`text-sm font-semibold transition-colors ${
          isActive ? 'text-teal-700' : 'text-gray-700 group-hover:text-gray-900'
        }`}>
          {concept.name}
        </span>
        <span
          className={`text-xs transition-transform duration-150 ml-2 shrink-0 ${
            expanded ? 'rotate-180' : ''
          } ${isActive ? 'text-teal-400' : 'text-gray-400'}`}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="pb-3 px-1 space-y-2">
          {concept.theoryBlocks.map(block => (
            <div
              key={block.id}
              className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
            >
              <MathMarkdown>{block.content}</MathMarkdown>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SSE consumer utility
// Reads a fetch response body as a stream, calling onEvent for each parsed event.
// ---------------------------------------------------------------------------

async function consumeSse(response: Response, onEvent: (event: SseEvent) => void) {
  const reader  = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer    = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) {
      const line = part.replace(/^data: /, '').trim()
      if (!line) continue
      try {
        const event = JSON.parse(line) as SseEvent
        onEvent(event)
        if (event.type === 'done') return
      } catch (e) {
        if (process.env.NODE_ENV === 'development') console.error('Failed to parse SSE event:', line, e)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main shell
// ---------------------------------------------------------------------------

const studentNavItems = [
  { label: 'Dashboard',     href: '/student/dashboard' },
  { label: 'My Courses',    href: '/student/courses' },
  { label: 'Review',        href: '/student/review' },
  { label: 'Notifications', href: '/notifications' },
]

// Pulsing placeholder shown while older messages are being fetched.
// Three rows simulate the visual weight of a mixed AI / student exchange.
function MessageHistorySkeleton() {
  return (
    <div className="space-y-5 py-2" aria-hidden>
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 animate-pulse rounded-full w-10/12" />
        <div className="h-3 bg-gray-100 animate-pulse rounded-full w-7/12" />
      </div>
      <div className="flex justify-end">
        <div className="h-3 bg-gray-100 animate-pulse rounded-full w-2/5" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 animate-pulse rounded-full w-full" />
        <div className="h-3 bg-gray-100 animate-pulse rounded-full w-5/6" />
        <div className="h-3 bg-gray-100 animate-pulse rounded-full w-1/2" />
      </div>
    </div>
  )
}

export default function SessionShell({ courseId, courseName, currentModule, allModules }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [leftOpen,  setLeftOpen]  = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'theory' | 'resources'>('theory')

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const [messages,       setMessages]       = useState<ChatMessage[]>([])
  // Exercises are pre-loaded from the module prop (already fetched server-side, answer fields stripped).
  // SSE events may add new exercises to this map during the session.
  const [exercises,      setExercises]      = useState<Record<string, StudentExercise>>(() =>
    Object.fromEntries(currentModule.exercises.map(ex => [String(ex.id), ex]))
  )
  const [streaming,      setStreaming]      = useState(false)
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false)
  const [activeExercise, setActiveExercise] = useState<number | null>(null)
  const activeExerciseRef = useRef<number | null>(null)

  // Pending queue: theory blocks and exercise cards are buffered here until the
  // student presses Space or Enter, then revealed one at a time.
  const [pendingMessages, setPendingMessages] = useState<ChatMessage[]>([])
  const pendingRef  = useRef<ChatMessage[]>([])
  const streamingRef = useRef(false)

  // History pagination: messages fetched but not yet displayed (instant-reveal buffer)
  const [bufferedMessages, setBufferedMessages] = useState<ChatMessage[]>([])
  const [hasMore,          setHasMore]          = useState(false)
  const [isFetchingMore,   setIsFetchingMore]   = useState(false)

  // Guards against React StrictMode's double-mount firing two concurrent advance calls
  const advancingRef     = useRef(false)
  // Prevents the IntersectionObserver from firing during the initial load
  const isInitialLoadRef = useRef(true)
  // Synchronous guard for loadMore — a ref avoids the stale-closure problem that state has
  const isFetchingMoreRef = useRef(false)
  // Scroll container — needed for scroll-position preservation on history prepend
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // Sentinel at the top of the message list — triggers loadMore when scrolled into view
  const topSentinelRef    = useRef<HTMLDivElement>(null)
  // Tracks the last-rendered message ID to distinguish appends from prepends in the auto-scroll guard
  const prevLastIdRef     = useRef<string | null>(null)
  // Ensures the very first scroll-to-bottom uses instant (no animation) to avoid visible page-load choppiness
  const hasInitialScrolledRef = useRef(false)
  // Maps message ID → animation-delay (ms) for the bottom-to-top stagger on history prepend
  const animatedIdsRef    = useRef<Map<string, number>>(new Map())
  // Stable ID for the AI bubble being built token-by-token
  const streamingAiId = useRef(crypto.randomUUID())
  const bottomRef     = useRef<HTMLDivElement>(null)

  // Token smoothing: incoming tokens are queued and drained one per animation
  // frame so text appears to flow character-by-character regardless of how
  // tokens arrive from the network (which often come in bursts).
  // Each entry carries the aiId captured at enqueue time — the `done` event
  // resets streamingAiId before the queue is fully drained, so reading
  // streamingAiId.current at drain time would target the wrong message.
  const tokenQueueRef = useRef<{ token: string; aiId: string }[]>([])
  const rafRef        = useRef<number | null>(null)

  // The concept IDs being tested by the currently active exercise.
  // Used to highlight and auto-scroll to the relevant concept in the Theory tab.
  const activeConceptIds: number[] =
    activeExercise !== null
      ? (exercises[String(activeExercise)]?.conceptIds ?? [])
      : []

  const drainTokenQueue = useCallback(() => {
    const item = tokenQueueRef.current.shift()
    if (item !== undefined) {
      setMessages(prev => {
        const idx = prev.findIndex(m => m.id === item.aiId && m.role === 'AI' && m.type === 'TEXT')
        if (idx === -1) {
          return [...prev, {
            id: item.aiId, sessionId: '', role: 'AI', type: 'TEXT',
            payload: { content: item.token }, order: prev.length + 1, createdAt: new Date().toISOString(),
          } as ChatMessage]
        }
        const msg = prev[idx] as ChatMessage & { payload: { content: string } }
        return [...prev.slice(0, idx), { ...msg, payload: { content: msg.payload.content + item.token } } as ChatMessage, ...prev.slice(idx + 1)]
      })
    }
    if (tokenQueueRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(drainTokenQueue)
    } else {
      rafRef.current = null
    }
  }, [])

  const apiBase = `${process.env.NEXT_PUBLIC_API_URL}/api/student/courses/${courseId}/modules/${currentModule.id}/session`

  // Auto-scroll to bottom only when a new message is APPENDED (not when history is prepended).
  // Comparing the last message ID means prepends — where the tail is unchanged — are ignored.
  useEffect(() => {
    const lastId     = messages[messages.length - 1]?.id ?? null
    const isAppended = lastId !== prevLastIdRef.current
    prevLastIdRef.current = lastId
    if (isAppended || pendingMessages.length > 0) {
      const behavior = hasInitialScrolledRef.current ? 'smooth' : 'instant'
      hasInitialScrolledRef.current = true
      bottomRef.current?.scrollIntoView({ behavior })
    }
  }, [messages, pendingMessages])

  const handleSseEvent = useCallback((event: SseEvent) => {
    switch (event.type) {
      case 'token':
        // Capture aiId at enqueue time — streamingAiId.current rotates on `done`,
        // which may arrive before the queue is fully drained.
        setAwaitingFirstToken(false)
        tokenQueueRef.current.push({ token: event.content, aiId: streamingAiId.current })
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(drainTokenQueue)
        }
        break
      case 'system:message':
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          sessionId: '',
          role: 'SYSTEM',
          type: 'SYSTEM_MESSAGE',
          payload: { content: event.payload.content },
          order: prev.length+1,
          createdAt: new Date().toISOString(),
        } as ChatMessage])
        break
      case 'system:theory_block': {
        const theoryMsg: ChatMessage = {
          id: crypto.randomUUID(),
          sessionId: '',
          role: 'SYSTEM',
          type: 'THEORY_BLOCK',
          payload: {
            conceptId: event.payload.conceptId,
            blocks: event.payload.blocks,
            visualizations: event.payload.visualizations ?? [],
            visualization: event.payload.visualization,
          },
          order: 0,
          createdAt: new Date().toISOString(),
        }
        pendingRef.current = [...pendingRef.current, theoryMsg]
        setPendingMessages(prev => [...prev, theoryMsg])
        break
      }
      case 'system:exercise_card':
      case 'system:prior_knowledge_question': {
        const exercise = event.payload.exercise
        // Store exercise data immediately so it's available when the card is revealed
        setExercises(prev => ({ ...prev, [String(exercise.id)]: exercise }))

        const cardMsg: ChatMessage = {
          id: crypto.randomUUID(),
          sessionId: '',
          role: 'SYSTEM',
          type: event.type === 'system:exercise_card' ? 'EXERCISE_CARD' : 'PRIOR_KNOWLEDGE_QUESTION',
          payload: { exerciseId: exercise.id, submitted: false },
          order: 0,
          createdAt: new Date().toISOString(),
        }
        pendingRef.current = [...pendingRef.current, cardMsg]
        setPendingMessages(prev => [...prev, cardMsg])
        // activeExercise is set when the card is revealed, not when it arrives
        break
      }
      case 'system:exercise_submitted':
        setMessages(prev => prev.map(m => {
          if (
            (m.type === 'EXERCISE_CARD' || m.type === 'PRIOR_KNOWLEDGE_QUESTION') &&
            (m.payload as any).exerciseId === event.payload.exerciseId
          ) {
            return { ...m, payload: { ...(m.payload as any), submitted: true, result: event.payload.result } } as ChatMessage
          }
          return m
        }))
        setActiveExercise(null)
        activeExerciseRef.current = null
        break
      case 'system:concept_mastery_reached':
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          sessionId: '',
          role: 'SYSTEM',
          type: 'CONCEPT_MASTERY_REACHED',
          payload: { conceptId: event.payload.conceptId, newEffectiveScore: event.payload.newEffectiveScore },
          order: prev.length+1,
          createdAt: new Date().toISOString(),
        } as ChatMessage])
        break
      case 'system:module_end_reached':
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          sessionId: '',
          role: 'SYSTEM',
          type: 'MODULE_END_REACHED',
          payload: { conceptScores: event.payload.conceptScores, nextModuleId: event.payload.nextModuleId },
          order: prev.length+1,
          createdAt: new Date().toISOString(),
        } as ChatMessage])
        break
      case 'done':
        setStreaming(false)
        setAwaitingFirstToken(false)
        streamingAiId.current = crypto.randomUUID()
        break

      default:
        break;
    }
  }, [drainTokenQueue])

  // Cancel pending rAF on unmount to avoid state updates on an unmounted component
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  // Keep streamingRef in sync so the keyboard handler can read it without stale closures
  useEffect(() => { streamingRef.current = streaming }, [streaming])

  // ---------------------------------------------------------------------------
  // revealNext — pops the front of the pending queue and adds it to messages.
  // For exercise/PKQ cards, also sets activeExercise so the card becomes interactive.
  // ---------------------------------------------------------------------------
  const revealNext = useCallback(() => {
    const [next, ...rest] = pendingRef.current
    if (!next) return
    pendingRef.current = rest
    setPendingMessages(rest)
    setMessages(prev => [...prev, next])
    if (next.type === 'EXERCISE_CARD' || next.type === 'PRIOR_KNOWLEDGE_QUESTION') {
      const exerciseId = (next.payload as any).exerciseId as number
      setActiveExercise(exerciseId)
      activeExerciseRef.current = exerciseId
    }
  }, [])

  // Space / Enter reveals the next queued item when the student is not typing
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space' && e.code !== 'Enter') return
      if (streamingRef.current) return
      if (pendingRef.current.length === 0) return
      const target = e.target as HTMLElement
      if (target.tagName === 'BUTTON') return
      e.preventDefault()
      revealNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [revealNext])

  // ---------------------------------------------------------------------------
  // callAdvance — called when activeExercise is null; asks server what's next
  // ---------------------------------------------------------------------------
  const callAdvance = useCallback(async (autoReveal = false, resume = false) => {
    // Synchronous guard — set before the first await so a concurrent call from
    // StrictMode's double-mount sees it immediately and exits without firing.
    if (advancingRef.current) return
    advancingRef.current = true
    setStreaming(true)
    try {
      const res = await apiFetch(`${apiBase}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume }),
      })
      await consumeSse(res, handleSseEvent)
      // On initial load there is no prior AI text for the student to finish reading,
      // so reveal all pending items immediately. After exercise submission the student
      // just received AI feedback and should press Space when they are ready.
      if (autoReveal) {
        while (pendingRef.current.length > 0) {
          revealNext()
        }
      }
    } finally {
      advancingRef.current = false
      setStreaming(false)
    }
  }, [apiBase, handleSseEvent, revealNext])

  // ---------------------------------------------------------------------------
  // Page load: GET /session, hydrate state, find activeExercise or call advance
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      // Fetch 7: show the 5 most recent, hold the 2 older ones as an instant-reveal buffer.
      const res = await apiFetch(`${apiBase}?limit=7`, { cache: 'no-store' })
      if (!res.ok) return

      const data: GetSessionResponse = await res.json()

      // Fire /advance immediately if the server already knows there's no active exercise —
      // no need to wait for message parsing. This eliminates the GET → parse → POST waterfall.
      if (!data.hasActiveExercise) {
        setActiveExercise(null)
        activeExerciseRef.current = null
        callAdvance(true, true)
      }

      // Unsubmitted-exercise detection searches across all 7 fetched messages (shown + buffered).
      // The active exercise is always among the most recent, so 7 is sufficient.
      const unsubmitted = data.hasActiveExercise
        ? [...data.messages]
            .reverse()
            .find(m =>
              (m.type === 'EXERCISE_CARD' || m.type === 'PRIOR_KNOWLEDGE_QUESTION')
              && !(m.payload as any).submitted
            )
        : undefined

      // Split fetched messages: last 5 displayed, earlier 2 buffered for instant reveal on scroll-up.
      // Exception: if the unsubmitted exercise card lives in the buffer (not in the last 5), promote
      // the entire buffer into shown — otherwise activeExercise would be set but the card wouldn't
      // be in the DOM, leaving the student stuck with the chat input disabled and no visible card.
      let shown    = data.messages.slice(-5)
      let buffered = data.messages.slice(0, Math.max(0, data.messages.length - 5))

      if (unsubmitted && buffered.some(m => m.id === unsubmitted.id)) {
        shown    = data.messages          // show all 7
        buffered = []
      }

      setMessages(shown)
      setBufferedMessages(buffered)
      setHasMore(data.hasMore)

      if (unsubmitted) {
        const id = (unsubmitted.payload as any).exerciseId
        setActiveExercise(id)
        activeExerciseRef.current = id
      }

      isInitialLoadRef.current = false
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // loadMore — triggered by IntersectionObserver when sentinel scrolls into view.
  // Shows a skeleton while fetching, then prepends the buffer + new batch in a
  // single React render (eliminating the double-paint flicker from two flushSync
  // calls). Scroll position is restored via a requestAnimationFrame callback that
  // runs after React has painted the new DOM.
  // ---------------------------------------------------------------------------
  const loadMore = useCallback(async () => {
    // Use a ref (not state) so this check is always fresh — isFetchingMore state
    // would be stale inside a closure captured before the last setState resolved.
    if (isFetchingMoreRef.current) return
    // Nothing buffered and no server pages left — exit without touching state.
    // Without this guard, the observer fires whenever loadMore's identity changes
    // (e.g. after revealNext updates `messages`), calling setBufferedMessages([])
    // on an already-empty array, which creates a new reference, re-triggering the
    // effect that re-attaches the observer, causing an infinite flicker loop.
    if (!hasMore && bufferedMessages.length === 0) return
    isFetchingMoreRef.current = true
    setIsFetchingMore(true)

    const container  = scrollContainerRef.current
    const before     = bufferedMessages[0]?.order ?? messages[0]?.order

    // Helper: register messages for the bottom-to-top stagger animation.
    // The last message in the array (closest to the existing content) gets 0 ms delay;
    // each step upward adds 40 ms so the group cascades from bottom to top.
    function registerAnimations(batch: ChatMessage[]) {
      batch.forEach((m, i) => {
        const delay = (batch.length - 1 - i) * 40
        animatedIdsRef.current.set(m.id, delay)
      })
    }

    // flushSync + immediate scrollTop correction: React commits the DOM synchronously
    // so we can measure the new scrollHeight and correct scrollTop — all in the same
    // JS task, before the browser paints. One paint, no visible jump.
    function prependAndAnchor(
      updater: (prev: ChatMessage[]) => ChatMessage[],
      extraUpdates?: () => void,
    ) {
      const prevHeight = container?.scrollHeight ?? 0
      flushSync(() => {
        setMessages(updater)
        extraUpdates?.()
      })
      if (container) {
        container.scrollTop += container.scrollHeight - prevHeight
      }
    }

    // If there's nothing more to fetch, just animate-in the buffer and stop.
    if (!hasMore || before === undefined) {
      registerAnimations(bufferedMessages)
      prependAndAnchor(
        prev => [...bufferedMessages, ...prev],
        ()   => setBufferedMessages([]),
      )
      const animDuration = 400 + bufferedMessages.length * 40
      setTimeout(() => bufferedMessages.forEach(m => animatedIdsRef.current.delete(m.id)), animDuration)
      isFetchingMoreRef.current = false
      setIsFetchingMore(false)
      return
    }

    try {
      const res = await apiFetch(`${apiBase}?limit=7&before=${before}`, { cache: 'no-store' })
      if (!res.ok) return
      const data: GetSessionResponse = await res.json()

      const newShown    = data.messages.slice(-5)
      const newBuffered = data.messages.slice(0, Math.max(0, data.messages.length - 5))

      // Combine the server batch and the local buffer into one insertion so React
      // produces a single render — no intermediate frame, no flicker.
      const toInsert = [...newShown, ...bufferedMessages]
      registerAnimations(toInsert)

      prependAndAnchor(
        prev => [...toInsert, ...prev],
        ()   => { setBufferedMessages(newBuffered); setHasMore(data.hasMore) },
      )

      const animDuration = 400 + toInsert.length * 40
      setTimeout(() => toInsert.forEach(m => animatedIdsRef.current.delete(m.id)), animDuration)
    } finally {
      isFetchingMoreRef.current = false
      setIsFetchingMore(false)
    }
  }, [hasMore, bufferedMessages, messages, apiBase])

  // Observe the top sentinel — re-attach whenever loadMore identity changes.
  useEffect(() => {
    const sentinel  = topSentinelRef.current
    const container = scrollContainerRef.current
    if (!sentinel || !container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isInitialLoadRef.current) loadMore()
      },
      { root: container, threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  // ---------------------------------------------------------------------------
  // handleExerciseSubmit — called when student submits an exercise card
  // ---------------------------------------------------------------------------
  async function handleExerciseSubmit(exerciseId: number, answer: string | number | Record<string, unknown>) {
    setStreaming(true)
    setAwaitingFirstToken(true)
    try {
      const body = typeof answer === 'object' && answer !== null && !Array.isArray(answer)
        ? { vizState: answer }
        : { answer }
      const res = await apiFetch(`${apiBase}/exercises/${exerciseId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      await consumeSse(res, handleSseEvent)
      if (activeExerciseRef.current === null && pendingRef.current.length === 0) {
        callAdvance()
      }
    } catch {
      toast.error('Something went wrong submitting your answer. Please refresh the page.')
    } finally {
      setStreaming(false)
    }
  }

  // ---------------------------------------------------------------------------
  // handleSend — free chat message
  // ---------------------------------------------------------------------------
  async function handleSend(message: RichMessage) {
    setStreaming(true)
    setAwaitingFirstToken(true)

    // Optimistically add student message so it appears immediately
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(), sessionId: '', role: 'STUDENT', type: 'TEXT',
      payload: { content: message.plainText, richContent: message.richContent, attachments: message.attachments },
      order: 0, createdAt: new Date().toISOString(),
    } as ChatMessage])

    try {
      const res = await apiFetch(`${apiBase}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content:     message.plainText,      // backwards compat for backend history builder
          richContent: message.richContent,
          attachments: message.attachments,
        }),
      })
      await consumeSse(res, handleSseEvent)
    } finally {
      setStreaming(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function renderMessage(msg: ChatMessage) {
    switch (msg.type) {
      case 'TEXT':
        return msg.role === 'AI'
          ? <AiMessage key={msg.id} content={msg.payload.content} />
          : <StudentMessage key={msg.id} content={(msg.payload as any).content} richContent={(msg.payload as any).richContent} />

      case 'SYSTEM_MESSAGE':
        return <SystemMessage key={msg.id} content={msg.payload.content} />

      case 'THEORY_BLOCK':
        return <TheoryBlock key={msg.id} blocks={msg.payload.blocks} visualizations={msg.payload.visualizations ?? []} visualization={msg.payload.visualization} />

      case 'EXERCISE_CARD':
      case 'PRIOR_KNOWLEDGE_QUESTION': {
        const ex = exercises[String(msg.payload.exerciseId)]
        if (!ex) return null
        const result: ExerciseResult | undefined = msg.payload.submitted ? msg.payload.result : undefined
        return (
          <ExerciseCard
            key={msg.id}
            exercise={ex}
            result={result}
            onSubmit={handleExerciseSubmit}
            disabled={streaming || msg.payload.exerciseId !== activeExercise}
          />
        )
      }

      case 'CONCEPT_MASTERY_REACHED':
        return (
          <ConceptMasteryCard
            key={msg.id}
            conceptId={msg.payload.conceptId}
            score={msg.payload.newEffectiveScore}
          />
        )

      case 'MODULE_END_REACHED': {
        const conceptNamesMap = Object.fromEntries(
          currentModule.concepts.map(c => [c.id, c.name])
        )
        return (
          <ModuleEndCard
            key={msg.id}
            conceptScores={msg.payload.conceptScores}
            nextModuleId={msg.payload.nextModuleId}
            courseId={courseId}
            conceptNames={conceptNamesMap}
          />
        )
      }

      default:
        return null
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">

      {/* ------------------------------------------------------------------ */}
      {/* Left icon rail — always visible, 44px wide                          */}
      {/* Hover to open the full navigation overlay                           */}
      {/* ------------------------------------------------------------------ */}
      <aside
        className="w-10 shrink-0 border-r border-gray-100 flex flex-col items-center pt-4 pb-4 bg-white"
        onMouseEnter={() => setLeftOpen(true)}
      >
        {/* Teal brand dot */}
        <div className="w-2 h-2 rounded-full bg-teal-600 shrink-0 mb-4 mt-1" />

        {/* Rotated label */}
        <div
          className={`flex-1 flex items-center justify-center transition-colors ${
            leftOpen ? 'text-teal-600' : 'text-gray-300 hover:text-gray-400'
          }`}
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          <span className="text-[10px] font-medium tracking-wide">Navigation</span>
        </div>
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Left nav overlay — slides in on hover, same content as dashboard    */}
      {/* fixed so it spans full viewport height and overlays chat area       */}
      {/* ------------------------------------------------------------------ */}
      <div
        onMouseLeave={() => setLeftOpen(false)}
        className={`fixed left-0 top-0 h-screen z-50 w-56 bg-white border-r border-gray-200 flex flex-col px-4 py-6 shadow-xl transition-transform duration-200 ease-out ${
          leftOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
      >
  {/* Logo / home */}
  <Link
    href="/student/dashboard"
    className="flex items-center gap-2 mb-6 shrink-0"
    onClick={() => setLeftOpen(false)}
  >
    <span className="text-base font-bold text-gray-900">Umenti</span>
  </Link>

  {/* Course header */}
  <p className="text-sm font-bold text-gray-900 truncate">{courseName}</p>
  <p className="text-xs text-gray-400 mt-0.5 mb-3">
    Module {currentModule.order + 1} of {allModules.length}
  </p>

  {/* Progress bar */}
  <div className="mb-4">
    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-teal-600 rounded-full transition-all"
        style={{ width: `${(currentModule.order / allModules.length) * 100}%` }}
      />
    </div>
    <p className="text-[10px] text-gray-400 text-right mt-1">
      {currentModule.order} of {allModules.length} complete
    </p>
  </div>

  {/* Module list */}
  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1 mb-2">
    Modules
  </p>
  <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
    {allModules.map((m) => {
      const isCurrentModule = m.id === currentModule.id
      const isDone = m.order < currentModule.order
      return (
        <Link
          key={m.id}
          href={`/student/courses/${courseId}/module/${m.id}/session`}
          onClick={() => setLeftOpen(false)}
          className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors ${
            isCurrentModule
              ? 'border border-teal-600 text-teal-600 font-semibold'
              : isDone
              ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isDone || isCurrentModule ? 'bg-teal-600' : 'bg-gray-300'
            }`}
          />
          <span className="truncate">{m.name}</span>
          {isDone && <span className="ml-auto text-[10px] text-teal-600 shrink-0">✓</span>}
        </Link>
      )
    })}
  </nav>

  {/* Bottom */}
  <div className="shrink-0 border-t border-gray-100 pt-3 mt-3">
    <Link
      href="/settings"
      onClick={() => setLeftOpen(false)}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
    >
      Account settings
    </Link>
  </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Center chat stream                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col flex-1 min-w-0">

        <div className="border-b border-gray-100 px-6 py-3 shrink-0">
          <p className="text-sm font-medium text-gray-700">{currentModule.name}</p>
        </div>

        {/* overflow-anchor:none disables the browser's automatic scroll anchoring so
            our flushSync+scrollTop correction is the sole source of truth.         */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32" ref={scrollContainerRef} style={{ overflowAnchor: 'none' }}>
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Sentinel: entering the viewport triggers loadMore() */}
            <div ref={topSentinelRef} />
            {isFetchingMore && <MessageHistorySkeleton />}
            {messages.length === 0 && !isFetchingMore && (
              <SystemMessage content="Loading session…" />
            )}
            {messages.map(msg => {
              const delay = animatedIdsRef.current.get(msg.id)
              return (
                <div
                  key={msg.id}
                  className={delay !== undefined ? 'message-history-in' : ''}
                  style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
                >
                  {renderMessage(msg)}
                </div>
              )
            })}
            {awaitingFirstToken && <AiTypingIndicator />}
            {!streaming && pendingMessages.length > 0 && (
              <ContinuePrompt onContinue={revealNext} />
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-gray-100 px-6 py-4 shrink-0">
          <div className="max-w-2xl mx-auto">
          <RichInput
            onSubmit={handleSend}
            disabled={!!activeExercise || streaming}
            placeholder={pendingMessages.length > 0 && !streaming ? 'Press Space to continue…' : undefined}
          />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Right expanded panel — pushes chat inward when open                 */}
      {/* ------------------------------------------------------------------ */}
      {rightOpen && (
        <aside className="w-72 shrink-0 border-l border-gray-200 flex flex-col">
          {/* Tab bar: Theory | Materials */}
          <div className="flex border-b border-gray-100 shrink-0">
            {(['theory', 'resources'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-gray-900 text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab === 'theory' ? 'Theory' : 'Materials'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'theory' && (
              <div className="divide-y divide-gray-100">
                {currentModule.concepts.map(concept => (
                  <ConceptSection
                    key={concept.id}
                    concept={concept}
                    isActive={activeConceptIds.includes(concept.id)}
                  />
                ))}
              </div>
            )}
            {activeTab === 'resources' && (
              <p className="text-sm text-gray-400 text-center mt-8">
                No materials attached to this module.
              </p>
            )}
          </div>
        </aside>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Right tab strip — always visible, 40px wide                         */}
      {/* Single "Resources" flap toggles the panel open/closed               */}
      {/* ------------------------------------------------------------------ */}
      <div className="w-10 shrink-0 border-l border-gray-100 flex flex-col bg-white">
        <button
          onClick={() => setRightOpen(o => !o)}
          className={`flex-1 flex items-center justify-center transition-colors ${
            rightOpen
              ? 'bg-gray-50 text-gray-700'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
          }`}
          style={{ writingMode: 'vertical-rl' }}
        >
          <span className="text-xs font-medium tracking-wide">Resources</span>
        </button>
      </div>

    </div>
  )
}
