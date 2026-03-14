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

export type ReviewStatus = 'UNREVIEWED' | 'IN_REVIEW' | 'APPROVED'

export type CourseTheoryBlock = {
  id: number
  content: string
  order: number
  pendingRevision: boolean
}

export type CourseConcept = {
  id: number
  name: string
  order: number
  theoryBlocks: CourseTheoryBlock[]
}

export type CourseExercise = {
  id: number
  type: 'MULTIPLE_CHOICE' | 'FREE_TEXT'
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
}

export type GetStudentCoursesResponse = StudentCourseItem[]

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