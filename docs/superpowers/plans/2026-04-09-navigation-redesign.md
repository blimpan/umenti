# Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the main sidebar, learning-session nav panel, and teacher course view (Overview + Content tabs) to use a unified "Polished Minimal" visual language — Lucide icons, teal border–only active states, user identity in the sidebar.

**Architecture:** `Sidebar.tsx` becomes a Client Component (needs `usePathname`). Six student pages and one teacher layout pass a new `userName` prop. The session panel inside `SessionShell.tsx` is restyled in-place (it already has the hover mechanic). `OverviewTab.tsx` and `ContentTab.tsx` receive targeted class changes only.

**Tech Stack:** Next.js 14, Tailwind CSS, Lucide React (already installed at ^0.577.0), Vitest + @testing-library/react

---

## File Map

| Action | File |
|---|---|
| Modify | `apps/web/src/components/Sidebar.tsx` |
| Create | `apps/web/src/components/Sidebar.test.tsx` |
| Modify | `apps/web/src/app/teacher/layout.tsx` |
| Modify | `apps/web/src/app/student/dashboard/page.tsx` |
| Modify | `apps/web/src/app/student/courses/page.tsx` |
| Modify | `apps/web/src/app/student/courses/[id]/page.tsx` |
| Modify | `apps/web/src/app/student/courses/[id]/module/[moduleId]/page.tsx` |
| Modify | `apps/web/src/app/student/review/page.tsx` |
| Modify | `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx` |
| Modify | `apps/web/src/app/teacher/courses/[id]/OverviewTab.tsx` |
| Modify | `apps/web/src/app/teacher/courses/[id]/ContentTab.tsx` |

---

## Task 1: Rewrite Sidebar.tsx

**Files:**
- Modify: `apps/web/src/components/Sidebar.tsx`
- Create: `apps/web/src/components/Sidebar.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/components/Sidebar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Sidebar from './Sidebar'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}))
vi.mock('./LogoutButton', () => ({
  default: () => <button>Log out</button>,
}))

import { usePathname } from 'next/navigation'

describe('Sidebar', () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue('/student/dashboard')
  })

  it('applies active classes to the current exact route', () => {
    vi.mocked(usePathname).mockReturnValue('/student/dashboard')
    render(<Sidebar role="STUDENT" userName="Linus Abc" />)
    const link = screen.getByRole('link', { name: /dashboard/i })
    expect(link.className).toContain('border-teal-600')
  })

  it('applies active classes to a nested child route', () => {
    vi.mocked(usePathname).mockReturnValue('/student/courses/42')
    render(<Sidebar role="STUDENT" userName="Linus Abc" />)
    const link = screen.getByRole('link', { name: /my courses/i })
    expect(link.className).toContain('border-teal-600')
  })

  it('does not apply active classes to non-current routes', () => {
    vi.mocked(usePathname).mockReturnValue('/student/dashboard')
    render(<Sidebar role="STUDENT" userName="Linus Abc" />)
    const link = screen.getByRole('link', { name: /my courses/i })
    expect(link.className).not.toContain('border-teal-600')
  })

  it('displays the first word of userName', () => {
    vi.mocked(usePathname).mockReturnValue('/student/dashboard')
    render(<Sidebar role="STUDENT" userName="Linus Abc" />)
    expect(screen.getByText('Linus')).toBeInTheDocument()
  })

  it('does not render Review or Notifications for TEACHER role', () => {
    vi.mocked(usePathname).mockReturnValue('/teacher/dashboard')
    render(<Sidebar role="TEACHER" userName="Ms Smith" />)
    expect(screen.queryByRole('link', { name: /review/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /notifications/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd apps/web && pnpm test -- Sidebar.test
```

Expected: several failures — `Sidebar` does not yet accept `userName` and has no `border-teal-600` class.

- [ ] **Step 3: Rewrite Sidebar.tsx**

Replace the entire file:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BookOpen, RotateCcw, Bell, Settings } from 'lucide-react'
import type { LucideProps } from 'lucide-react'
import { Role } from '@metis/types'
import LogoutButton from './LogoutButton'

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<LucideProps>
}

const navItems: Record<Role, NavItem[]> = {
  STUDENT: [
    { label: 'Dashboard',     href: '/student/dashboard', icon: LayoutDashboard },
    { label: 'My Courses',    href: '/student/courses',   icon: BookOpen },
    { label: 'Review',        href: '/student/review',    icon: RotateCcw },
    { label: 'Notifications', href: '/notifications',     icon: Bell },
  ],
  TEACHER: [
    { label: 'Dashboard',  href: '/teacher/dashboard', icon: LayoutDashboard },
    { label: 'My Courses', href: '/teacher/courses',   icon: BookOpen },
  ],
}

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function Sidebar({ role, userName }: { role: Role; userName: string }) {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const homeHref = role === 'TEACHER' ? '/teacher/dashboard' : '/student/dashboard'

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col border-r border-gray-200 bg-white px-3 py-6">
      {/* Logo */}
      <Link href={homeHref} className="flex items-center gap-2 px-3 mb-8">
        <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
        <span className="text-base font-bold text-gray-900">Umenti</span>
      </Link>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems[role].map(({ label, href, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'border border-teal-600 text-teal-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon size={16} className={active ? 'text-teal-600' : 'text-gray-400'} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="flex flex-col gap-1 border-t border-gray-100 pt-3">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <Settings size={16} className="text-gray-400" />
          Account settings
        </Link>

        <div className="flex items-center gap-2.5 px-3 py-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-600 to-teal-400 flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold leading-none">{initials(userName)}</span>
          </div>
          <span className="text-xs text-gray-500 truncate">{userName.split(' ')[0]}</span>
        </div>

        <LogoutButton />
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
cd apps/web && pnpm test -- Sidebar.test
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Sidebar.tsx apps/web/src/components/Sidebar.test.tsx
git commit -m "feat: redesign Sidebar with icons, active state, and user identity"
```

---

## Task 2: Pass userName to all Sidebar call sites

**Files:**
- Modify: `apps/web/src/app/teacher/layout.tsx`
- Modify: `apps/web/src/app/student/dashboard/page.tsx`
- Modify: `apps/web/src/app/student/courses/page.tsx`
- Modify: `apps/web/src/app/student/courses/[id]/page.tsx`
- Modify: `apps/web/src/app/student/courses/[id]/module/[moduleId]/page.tsx`
- Modify: `apps/web/src/app/student/review/page.tsx`

- [ ] **Step 1: Update teacher/layout.tsx**

The file already calls `supabase.auth.getUser()`. Add `userName` derivation and pass it:

```tsx
// After: const { data: { user } } = await supabase.auth.getUser()
const userName = user.user_metadata?.full_name ?? user.email ?? 'Teacher'

// Change: <Sidebar role="TEACHER" />
// To:
<Sidebar role="TEACHER" userName={userName} />
```

- [ ] **Step 2: Update student/dashboard/page.tsx**

The file calls `supabase.auth.getSession()` and has `session`. Add after the role redirect check:

```tsx
const userName = session.user.user_metadata?.full_name ?? session.user.email ?? 'Student'
```

Change:
```tsx
<Sidebar role="STUDENT" />
```
To:
```tsx
<Sidebar role="STUDENT" userName={userName} />
```

- [ ] **Step 3: Update student/courses/page.tsx**

Open `apps/web/src/app/student/courses/page.tsx`. It calls `supabase.auth.getSession()`. Apply the same pattern as Step 2 — add `userName` derivation after the session check and pass it to `<Sidebar>`.

- [ ] **Step 4: Update student/courses/[id]/page.tsx**

Open `apps/web/src/app/student/courses/[id]/page.tsx`. Same pattern — derive `userName` from `session.user` and pass it.

- [ ] **Step 5: Update student/courses/[id]/module/[moduleId]/page.tsx**

Open `apps/web/src/app/student/courses/[id]/module/[moduleId]/page.tsx`. Same pattern.

- [ ] **Step 6: Update student/review/page.tsx**

Open `apps/web/src/app/student/review/page.tsx`. Same pattern.

- [ ] **Step 7: Verify TypeScript compiles cleanly**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors. If any file still passes `<Sidebar role="STUDENT" />` without `userName`, TypeScript will flag it here.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/teacher/layout.tsx \
  apps/web/src/app/student/dashboard/page.tsx \
  apps/web/src/app/student/courses/page.tsx \
  "apps/web/src/app/student/courses/[id]/page.tsx" \
  "apps/web/src/app/student/courses/[id]/module/[moduleId]/page.tsx" \
  apps/web/src/app/student/review/page.tsx
git commit -m "feat: pass userName to Sidebar in all call sites"
```

---

## Task 3: Redesign session nav panel in SessionShell.tsx

**Files:**
- Modify: `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx`

Context: The panel already exists as a fixed overlay (lines ~975–1045). It already has:
- Working `leftOpen` / `setLeftOpen` hover mechanic (trigger on the `w-10` aside rail)
- Slide-in transition (`-translate-x-full` → `translate-x-0`)
- Module list with number badges

Changes: remove the generic student nav items, add course progress bar, replace number badges with status dots, apply teal border active state on current module.

**Note on module completion:** The panel only receives `currentModule` and `allModules`. It does not have concept-level score data. Treat modules with `order < currentModule.order` as done (teal dot), the current module as active (teal border, no fill), and the rest as upcoming (gray dot). This is a UI-level approximation; accurate completion state lives in the session itself.

- [ ] **Step 1: Locate and replace the overlay panel div**

Find the block starting at (approximately):
```tsx
{/* Left nav overlay — slides in on hover, same content as dashboard    */}
<div
  onMouseLeave={() => setLeftOpen(false)}
  className={`fixed left-0 top-0 h-screen z-50 w-56 ...`}
>
```

Replace the entire contents of that `<div>` (everything between the opening and closing tags of the overlay div, keeping the outer `<div>` with its `onMouseLeave` and className unchanged) with:

```tsx
  {/* Logo / home */}
  <Link
    href="/student/dashboard"
    className="flex items-center gap-2 mb-6 shrink-0"
    onClick={() => setLeftOpen(false)}
  >
    <span className="w-2 h-2 rounded-full bg-teal-600 shrink-0" />
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
```

- [ ] **Step 2: Also update the left icon rail (the w-10 aside)**

Find:
```tsx
<aside
  className="w-10 shrink-0 border-r border-gray-100 flex flex-col items-center pt-4 pb-4 bg-white"
  onMouseEnter={() => setLeftOpen(true)}
>
  {/* Logo */}
  <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center shrink-0 mb-4">
    <span className="text-white text-xs font-bold">M</span>
  </div>

  {/* Rotated label — mirrors the Resources rail on the right */}
  <div
    className={`flex-1 flex items-center justify-center transition-colors ${
      leftOpen ? 'text-gray-700' : 'text-gray-400 hover:text-gray-600'
    }`}
    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
  >
    <span className="text-xs font-medium tracking-wide">Navigation</span>
  </div>
</aside>
```

Replace with:
```tsx
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
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx"
git commit -m "feat: redesign session nav panel with progress bar and teal border active state"
```

---

## Task 4: Update OverviewTab.tsx

**Files:**
- Modify: `apps/web/src/app/teacher/courses/[id]/OverviewTab.tsx`

Changes: remove `border-l-4` color coding from module rows, replace with status dot; highlight Approved stat card with teal border when fully approved.

- [ ] **Step 1: Replace the REVIEW_BORDER map and module card className**

Remove these lines at the top of the file:
```tsx
const REVIEW_BORDER: Record<string, string> = {
  UNREVIEWED: 'border-l-gray-200',
  IN_REVIEW:  'border-l-yellow-400',
  APPROVED:   'border-l-green-400',
}
```

Find the module card button:
```tsx
className={`w-full text-left rounded-xl border-l-4 border border-gray-200 p-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4 ${REVIEW_BORDER[module.reviewStatus]}`}
```

Replace with:
```tsx
className="w-full text-left rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4"
```

- [ ] **Step 2: Add status dot inside the module card**

Find the inner div:
```tsx
<div className="min-w-0">
  <p className="font-medium text-gray-900 truncate">{module.name}</p>
```

Replace with:
```tsx
<div className="flex items-center gap-3 min-w-0">
  <span className={`w-2 h-2 rounded-full shrink-0 ${
    module.reviewStatus === 'APPROVED'  ? 'bg-green-500' :
    module.reviewStatus === 'IN_REVIEW' ? 'bg-yellow-400' :
    'bg-gray-300'
  }`} />
  <div className="min-w-0">
    <p className="font-medium text-gray-900 truncate">{module.name}</p>
```

Close the new wrapper div after the existing inner `</div>`:
```tsx
    </div>
  </div>
```

So the full updated module card inner JSX is:
```tsx
<div className="flex items-center gap-3 min-w-0">
  <span className={`w-2 h-2 rounded-full shrink-0 ${
    module.reviewStatus === 'APPROVED'  ? 'bg-green-500' :
    module.reviewStatus === 'IN_REVIEW' ? 'bg-yellow-400' :
    'bg-gray-300'
  }`} />
  <div className="min-w-0">
    <p className="font-medium text-gray-900 truncate">{module.name}</p>
    <p className="text-sm text-gray-400 mt-0.5">
      {module.concepts.length} concept{module.concepts.length !== 1 ? 's' : ''} ·{' '}
      {module.exercises.length} exercise{module.exercises.length !== 1 ? 's' : ''}
    </p>
  </div>
</div>
```

- [ ] **Step 3: Highlight the Approved stat card**

Find the stat card grid. The stat items are rendered with `.map()`. Change the map to detect the "Approved" stat:

```tsx
{[
  { label: 'Modules',   value: course.modules.length },
  { label: 'Concepts',  value: totalConcepts },
  { label: 'Exercises', value: totalExercises },
  { label: 'Approved',  value: `${approvedCount} / ${course.modules.length}` },
].map((stat) => {
  const isApprovedComplete =
    stat.label === 'Approved' &&
    course.modules.length > 0 &&
    approvedCount === course.modules.length
  return (
    <div
      key={stat.label}
      className={`rounded-xl border p-5 ${
        isApprovedComplete ? 'border-teal-600' : 'border-gray-200'
      }`}
    >
      <p className={`text-2xl font-semibold ${isApprovedComplete ? 'text-teal-600' : 'text-gray-900'}`}>
        {stat.value}
      </p>
      <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
    </div>
  )
})}
```

- [ ] **Step 4: TypeScript check**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/teacher/courses/[id]/OverviewTab.tsx"
git commit -m "feat: replace left-border status coding with dots in OverviewTab"
```

---

## Task 5: Update ContentTab.tsx

**Files:**
- Modify: `apps/web/src/app/teacher/courses/[id]/ContentTab.tsx`

Changes: sidebar `bg-gray-50` → `bg-white`; selected module: remove white card + shadow, replace with teal border no-fill; text badges → status dots.

- [ ] **Step 1: Update sidebar background**

Find:
```tsx
<aside className="w-60 shrink-0 border-r bg-gray-50 flex flex-col overflow-hidden">
```

Replace with:
```tsx
<aside className="w-60 shrink-0 border-r bg-white flex flex-col overflow-hidden">
```

- [ ] **Step 2: Replace module button active/inactive styles**

Find the module button className:
```tsx
className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 flex items-center justify-between gap-2 transition-colors text-sm ${
  selectedModule?.id === module.id
    ? 'bg-white shadow-sm font-medium text-gray-900'
    : 'text-gray-600 hover:bg-white hover:text-gray-900'
}`}
```

Replace with:
```tsx
className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 flex items-center justify-between gap-2 transition-colors text-sm ${
  selectedModule?.id === module.id
    ? 'border border-teal-600 text-teal-600 font-semibold'
    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
}`}
```

- [ ] **Step 3: Replace text status badges with dots**

Find the status badge `<span>` inside the module button:
```tsx
<span
  className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${REVIEW_BADGE[module.reviewStatus]}`}
>
  {REVIEW_LABEL[module.reviewStatus]}
</span>
```

Replace with:
```tsx
<span className={`w-2 h-2 rounded-full shrink-0 ${
  module.reviewStatus === 'APPROVED'  ? 'bg-green-500' :
  module.reviewStatus === 'IN_REVIEW' ? 'bg-yellow-400' :
  'bg-gray-300'
}`} />
```

- [ ] **Step 4: Remove now-unused REVIEW_BADGE and REVIEW_LABEL constants**

Delete these lines at the top of the file:
```tsx
const REVIEW_BADGE: Record<string, string> = {
  UNREVIEWED: 'bg-gray-100 text-gray-500',
  IN_REVIEW:  'bg-yellow-50 text-yellow-700',
  APPROVED:   'bg-green-50 text-green-700',
}

const REVIEW_LABEL: Record<string, string> = {
  UNREVIEWED: 'New',
  IN_REVIEW:  'In review',
  APPROVED:   'Approved',
}
```

- [ ] **Step 5: TypeScript check and full test run**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | head -30
cd apps/web && pnpm test
```

Expected: no TypeScript errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/teacher/courses/[id]/ContentTab.tsx"
git commit -m "feat: white sidebar bg, teal border selected module, status dots in ContentTab"
```

---

## Manual verification checklist

After all tasks:

- [ ] Student dashboard: sidebar shows teal border on Dashboard link, no fill
- [ ] Navigate to My Courses: Dashboard loses active, My Courses gains teal border
- [ ] Sidebar bottom shows user's first name and initials avatar
- [ ] Teacher sidebar: only Dashboard and My Courses links appear
- [ ] Learning session: hover far-left rail → panel slides in with course progress + module list
- [ ] Active module in session panel has teal border, no fill; done modules have teal dot + ✓
- [ ] Teacher course Overview: module rows have colored dots (no left border), Approved stat card turns teal when all approved
- [ ] Teacher course Content: module sidebar is white, selected module has teal border, status shown as dot
