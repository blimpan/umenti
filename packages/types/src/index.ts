// Shared TypeScript types consumed by both apps/web and apps/api
// Add API response shapes, domain types, and shared enums here

// --- Course wizard ---

export type CourseWizardObjective = {
  id: string
  text: string
}

export type CourseWizardOutcome = {
  id: string
  text: string
  objectiveIds: string[]
}

export type CourseWizardModule = {
  id: string
  name: string
  objectives: CourseWizardObjective[]
  outcomes: CourseWizardOutcome[]
}

export type CourseWizardInput = {
  name: string
  subject: string
  language: string
  targetAudience: string
  modules: CourseWizardModule[]
  materials?: {
    type: 'file' | 'link'
    filename?: string
    storageKey?: string
    title?: string
    url?: string
    moduleIds: string[]
  }[]
}

export type WizardSuggestContext = {
  name?: string
  subject?: string
  language?: string
  targetAudience?: string
  moduleName?: string
  existingObjectives?: string[]
  existingModuleNames?: string[]
}

export type WizardSuggestRequest = {
  field: string
  context: WizardSuggestContext
}

export type WizardSuggestResponse = {
  suggestion: string
}

export type CreateCourseResponse = {
  courseId: number
}

export type CourseStatus = 'GENERATING' | 'FAILED' | 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'ARCHIVED'

export type CourseListItem = {
  id: number
  name: string
  subject: string
  status: CourseStatus
  createdAt: string
}

export type GetCoursesResponse = CourseListItem[]

// --- Course editor ---

export type ReviewStatus = 'UNREVIEWED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED'

export type CourseTheoryBlock = {
  id: number
  content: string
  order: number
  pendingRevision: boolean
}

export type ConceptVisualization = {
  id: number
  order: number
  visualizationType: string            // templateId e.g. "cartesian_graph"
  visualizationParams: Record<string, unknown>
  visualization?: string | null        // custom HTML fallback
}

export type CourseConcept = {
  id: number
  name: string
  order: number
  conceptType?: string | null
  theoryBlocks: CourseTheoryBlock[]
  visualization?: string               // legacy custom HTML — kept for old courses
  visualizations: ConceptVisualization[]
}

export type CanonicalExpression = {
  label: string
  sympyExpr: string | null   // null = LLM-only claim; SymPy could not normalize
}

export type CourseExercise = {
  id: number
  type: 'MULTIPLE_CHOICE' | 'FREE_TEXT' | 'INTERACTIVE'
  question: string
  order: number
  pendingRevision: boolean
  conceptIds: number[]
  // MULTIPLE_CHOICE
  options: string[] | null
  correctIndex: number | null
  explanation: string | null
  // FREE_TEXT
  sampleAnswer: string | null
  rubric: string | null
  canonicalExpressions: CanonicalExpression[] | null  // null = not yet extracted
  // INTERACTIVE / legacy
  visualizationHtml: string | null
  visualizationType: string | null            // new
  visualizationParams: Record<string, unknown> | null  // new
}

export type CourseModule = {
  id: number
  name: string
  order: number
  reviewStatus: ReviewStatus
  whyThisModule: string | null
  buildsOn: string | null
  leadsInto: string | null
  objectives: { id: number; text: string }[]
  outcomes: { id: number; text: string }[]
  concepts: CourseConcept[]
  exercises: CourseExercise[]
}

export type CourseDetail = {
  id: number
  name: string
  subject: string
  language: string
  targetAudience: string
  status: CourseStatus
  modules: CourseModule[]
}

// Lightweight course shape used by the student course overview and module landing pages.
// Does not include theory blocks or exercises.
export type CourseOverviewModule = {
  id: number
  name: string
  order: number
  whyThisModule: string | null
  buildsOn: string | null
  leadsInto: string | null
  outcomes: { id: number; text: string }[]
  concepts: { id: number; name: string; order: number }[]
}

export type CourseOverview = {
  id: number
  name: string
  subject: string
  status: CourseStatus
  modules: CourseOverviewModule[]
}

// Response for the single-module endpoint used by the session page.
export type GetCourseModuleResponse = {
  courseName: string
  module: StudentCourseModule
  allModules: { id: number; name: string; order: number }[]
}

// --- Enrollments ---

export type EnrollmentStatus = 'PENDING' | 'ACTIVE' | 'REJECTED'

export type CourseEnrollment = {
  id: number
  email: string
  status: EnrollmentStatus
  userId: string | null
  createdAt: string
}

export type GetEnrollmentsResponse = CourseEnrollment[]

export type StudentCourseItem = {
  enrollmentId: number
  enrollmentStatus: 'PENDING' | 'ACTIVE'
  course: {
    id: number
    name: string
    subject: string
    status: CourseStatus
  }
  lastModuleId: number | null
  lastModuleName: string | null
  overallProgress: number  // 0–100 average effective score across all course concepts
}

export type GetStudentCoursesResponse = StudentCourseItem[]

// --- Student progress ---

export type ConceptProgressItem = {
  conceptId: number
  effectiveScore: number  // decay already applied by the API — do not recompute on the frontend
}

export type GetConceptProgressResponse = ConceptProgressItem[]

// --- Learning session ---

// Server strips answer fields before sending to client
export type StudentExercise = Omit<CourseExercise, 'correctIndex' | 'sampleAnswer' | 'rubric'>

// CourseModule with answer fields stripped from exercises — safe to send to the browser
export type StudentCourseModule = Omit<CourseModule, 'exercises'> & {
  exercises: StudentExercise[]
}

export type ExerciseResult = {
  correct: boolean
  almost?: boolean      // only meaningful when correct === false
  scoreChange: number
  feedback: string
}

// Discriminated union — `type` narrows the `payload` shape automatically
export type ChatMessage = {
  id: string
  sessionId: string
  role: 'AI' | 'STUDENT' | 'SYSTEM'
  order: number
  createdAt: string
} & (
  | { type: 'TEXT';                     payload: { content: string } }
  | { type: 'SYSTEM_MESSAGE';           payload: { content: string } }
  | { type: 'THEORY_BLOCK';             payload: { conceptId: number; blocks: string[]; visualizations: ConceptVisualization[]; visualization?: string } }
  | { type: 'EXERCISE_CARD';            payload: { exerciseId: number; submitted: boolean; result?: ExerciseResult } }
  | { type: 'PRIOR_KNOWLEDGE_QUESTION'; payload: { exerciseId: number; submitted: boolean; result?: ExerciseResult } }
  | { type: 'CONCEPT_MASTERY_REACHED';  payload: { conceptId: number; newEffectiveScore: number } }
  | { type: 'MODULE_END_REACHED';       payload: { conceptScores: { conceptId: number; effectiveScore: number }[]; nextModuleId?: number } }
)

export type SseEvent =
  | { type: 'token';                           content: string }
  | { type: 'system:message';                  payload: { content: string } }
  | { type: 'system:theory_block';             payload: { conceptId: number; blocks: string[]; visualizations: ConceptVisualization[]; visualization?: string } }
  | { type: 'system:exercise_card';            payload: { exerciseId: number; exercise: StudentExercise } }
  | { type: 'system:prior_knowledge_question'; payload: { exerciseId: number; exercise: StudentExercise } }
  | { type: 'system:exercise_submitted';       payload: { exerciseId: number; result: ExerciseResult } }
  | { type: 'system:concept_mastery_reached';  payload: { conceptId: number; newEffectiveScore: number } }
  | { type: 'system:module_end_reached';       payload: { conceptScores: { conceptId: number; effectiveScore: number }[]; nextModuleId?: number } }
  | { type: 'done' }

export type GetSessionResponse = {
  session:  { id: string; createdAt: string }
  messages: ChatMessage[]
  hasMore:  boolean
}

// --- Review (spaced repetition queue) ---

export type ReviewConcept = {
  conceptId: number
  conceptName: string
  moduleId: number
  moduleName: string
  courseId: number
  courseName: string
  rawScore: number        // stored score, before decay
  effectiveScore: number  // decay-applied score — what determines mastery
  lastActivityAt: string  // ISO date string
}

export type GetReviewConceptsResponse = ReviewConcept[]

// --- Users ---

export const Role = {
    TEACHER: 'TEACHER',
    STUDENT: 'STUDENT'
} as const

export type Role = typeof Role[keyof typeof Role]

export interface User {
    id: string
    email: string
    role: Role
}

// --- Teacher analytics ---

export type CourseAnalyticsStudent = {
  email: string
  progress: number | null  // 0–100 decay-weighted average effective score; null = student has not started any concept
  lastActiveAt: string | null  // ISO 8601 string; null = student has never opened a module
}

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

// --- Rich input (TipTap editor) ---

// JSONContent is TipTap's document tree shape. Declared locally to avoid
// pulling @tiptap/core into environments that don't use the editor (e.g. apps/api).
type JSONContent = {
  type?: string
  attrs?: Record<string, unknown>
  content?: JSONContent[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
  [key: string]: unknown
}

export type ImageAttachment = {
  url: string       // Supabase Storage public URL
  filename: string
}

export type RichMessage = {
  richContent: JSONContent     // TipTap document tree — for DB storage and re-rendering
  plainText: string            // extracted plain text — used as LLM input
  attachments: ImageAttachment[]
}
