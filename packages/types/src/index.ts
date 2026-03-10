// Shared TypeScript types consumed by both apps/web and apps/api
// Add API response shapes, domain types, and shared enums here

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