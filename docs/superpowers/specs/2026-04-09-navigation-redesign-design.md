# Navigation Redesign — Design Spec

**Date:** 2026-04-09
**Surfaces:** Main sidebar · Session hover-panel · Teacher course view (Overview + Content tabs)

---

## Overview

Four surfaces in Metis are being redesigned under the same visual language — "Polished Minimal". The unifying active/selected-state treatment across all surfaces: **teal border on all four sides, no background fill**.

---

## 1. Main Sidebar (`Sidebar.tsx`)

### What it is
Persistent left sidebar visible on all non-session routes (dashboard, courses, settings, etc.) for both students and teachers.

### Current problems
- No active state: every link looks identical regardless of the current route
- No icons: pure text links with no visual anchor
- No user identity: the user has no presence in the nav
- Settings/logout live outside the nav hierarchy, inconsistently

### Redesigned layout (top to bottom)

**Logo area**
- App name "Umenti" in `font-bold` with a small teal dot (●) to the left as a brand mark
- Link wraps the whole area → navigates to role home (`/student/dashboard` or `/teacher/dashboard`)

**Nav items** (role-specific, same as current)
- Student: Dashboard, My Courses, Review, Notifications
- Teacher: Dashboard, My Courses
- Each item: Lucide icon (16px) + label text, `text-sm font-medium`
- Inactive: `text-gray-500`, icon `text-gray-400`, no border, no background
- Hover: `text-gray-700`, icon `text-gray-500`, light gray background (`bg-gray-100`)
- Active: `text-teal-600`, icon `text-teal-600`, `border border-teal-600 rounded-lg`, **no background fill**

**Icon assignments**
| Label | Lucide icon |
|---|---|
| Dashboard | `LayoutDashboard` |
| My Courses | `BookOpen` |
| Review | `RotateCcw` |
| Notifications | `Bell` |

**Spacer** — pushes bottom section to the foot of the sidebar

**Bottom section** (separated by a subtle divider)
- Account Settings link — `Settings` icon + "Account settings" label, same hover style as nav items
- User identity row — small avatar circle (gradient teal, initials) + user's first name, `text-xs text-gray-500`
- Logout button — existing `LogoutButton` component, text only, `text-xs text-gray-400`

### Dimensions & chrome
- Width: `w-56` (unchanged)
- Background: `bg-white`
- Right border: `border-r border-gray-200`
- Sticky, full height: `h-screen sticky top-0`
- Padding: `px-3 py-6`

### Active state detection
Use Next.js `usePathname()` hook in a Client Component wrapper. The `Sidebar` component becomes a Client Component (or wraps a thin `NavItem` client child) to read the current path and apply the active class.

### Props change
The current `Sidebar` signature is `{ role: Role }`. It needs to become:
```ts
{ role: Role; userName: string }
```
Both `TeacherLayout` and the student layout already have the authenticated user from `supabase.auth.getUser()` — pass `user.user_metadata?.full_name ?? user.email` as `userName`.

### What is NOT changing
- Width, background color, border-right
- Role-based nav item lists
- Logout button component

---

## 2. Session Hover-Panel

### What it is
A panel that appears when the student moves their cursor to the far left edge of the screen during a learning session. Hidden by default; overlays the chat stream when revealed. Not yet implemented.

### Content (top to bottom)

**Back link**
- `←` chevron icon (`ChevronLeft`, 14px) + "Dashboard" label
- `text-xs text-gray-400`, navigates to `/student/dashboard`
- Sits at the very top of the panel

**Course header**
- Course name — `text-sm font-bold text-gray-900`
- Sub-label — e.g. "Module 3 of 7" — `text-xs text-gray-400`

**Progress bar**
- Thin bar (`h-1`), gray track, teal fill
- Percentage label right-aligned below: `text-[10px] text-gray-400`
- Progress = completed modules / total modules

**Section label** — "MODULES" in `text-[10px] font-bold uppercase tracking-widest text-gray-400`

**Module list**
- One row per module, ordered by `CourseModule.order ASC`
- Each row: status dot + module name
- Done (effective score ≥ 90 for all concepts): teal dot + `text-gray-400`, checkmark `✓` at right
- Active (current module): teal dot, teal border (all sides, no fill), `text-teal-600 font-semibold`
- Upcoming: gray dot, `text-gray-500`
- Module names truncate with ellipsis if too long

**Bottom links** (pinned to foot of panel)
- Divider + "Account settings" link in `text-xs text-gray-400`

### Reveal behavior
- Hidden by default (`translate-x-[-100%]` or `opacity-0 pointer-events-none`)
- Trigger: `onMouseEnter` on a thin invisible strip (~16px wide) at the left edge of the session container
- Hide: `onMouseLeave` on the panel itself (with a short delay to prevent flicker)
- Animation: `transition-transform duration-200` slide in from left — **not** a fade
- The panel overlays the chat stream; it does not push/resize it
- Width: `w-56` (same as main sidebar)
- Background: `bg-white`, `shadow-lg`, `border-r border-gray-200`

### Props
```ts
interface SessionPanelProps {
  courseId: string
  courseName: string
  currentModule: { id: number; name: string; order: number }
  allModules: { id: number; name: string; order: number }[]
  totalModules: number
  completedModules: number   // modules where all concept effective scores ≥ 90
}
```

### Component location
`apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionPanel.tsx`

Used inside `SessionShell.tsx` — the shell renders both the invisible trigger strip and the panel.

---

## 3. Teacher Course View — Overview Tab (`OverviewTab.tsx`)

### Current problems
- Module list uses left-border color coding for review status (green/yellow/gray) — inconsistent with the design direction away from left-border accents
- No visual distinction on the Approved stat card when all modules are approved

### Changes

**Module list rows**
- Remove `border-l-4` left-border color coding
- Add a **small status dot** (7px circle) at the far left of each row, before the module name
  - Approved: `bg-green-500`
  - In review: `bg-yellow-400`
  - Unreviewed: `bg-gray-300`
- The review status badge on the right (`Approved`, `In review`, `Unreviewed`) stays unchanged
- Row hover: `hover:bg-gray-50` (unchanged)

**Approved stat card**
- When `approvedCount === course.modules.length && course.modules.length > 0`: add `border-teal-600` to the stat card border, `text-teal-600` on the value
- Otherwise: unchanged gray border + gray value text

**What is NOT changing**
- Stat grid layout and values
- Progress bar
- Status banners (yellow/green alert boxes below the module list)
- Students section
- Header, tab bar, breadcrumb, Settings/Publish buttons

---

## 4. Teacher Course View — Content Tab (`ContentTab.tsx`)

### Current problems
- Module sidebar uses `bg-gray-50` background — redundant given the existing `border-r` separator
- Selected module uses `bg-white shadow-sm` — inconsistent with the new design language
- Status badges inside the sidebar are text (`New`, `In review`, `Approved`) — too wide for the `w-60` sidebar when module names are long

### Changes

**Module sidebar background**
- `bg-gray-50` → `bg-white`

**Selected module item**
- Remove: `bg-white shadow-sm font-medium text-gray-900`
- Add: `border border-teal-600 rounded-lg text-teal-600 font-semibold` (no background fill — same token as all other active states)

**Status indicator in sidebar**
- Replace text badges (`New`, `In review`, `Approved`) with a small status dot (same 7px dot system as Overview tab), right-aligned within each row
- This frees horizontal space for module names to breathe

**What is NOT changing**
- Sidebar width (`w-60`)
- Module count header (`p` / `approved` counter)
- `ModuleEditor` component and all content to its right
- `isFullBleed` layout behaviour (Content tab fills the viewport height)

---

## Shared design tokens (active state)

```
border: 1px solid #0d9488   (teal-600)
border-radius: 0.5rem       (rounded-lg)
background: transparent
color: #0d9488              (teal-600)
icon color: #0d9488
```

Tailwind classes: `border border-teal-600 rounded-lg text-teal-600`

---

## Out of scope

- Dark mode
- Collapsible / icon-only sidebar mode
- Notification badges on the Bell icon
- Teacher session panel (teachers do not have learning sessions)
- Mobile / responsive nav (future)
- Analytics tab (being redesigned separately)
- `ModuleEditor` internals (content of the selected module — not in scope)
- `SettingsModal` styling
