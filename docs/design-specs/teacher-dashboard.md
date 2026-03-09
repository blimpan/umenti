# Teacher Dashboard (`/teacher/dashboard`)

The teacher's home base. Organized around courses, not tasks. Each course surfaces its own activity at a glance via badge counters — the teacher decides which course to act on and drills in from there.

## Layout

Persistent left sidebar. Main content area is a grid of course cards (2 columns on wide screens, 1 on narrow).

## Left sidebar contents

- App logo / home link
- Navigation: Dashboard, My Courses, Create Course
- Account / settings at bottom

## Course cards

One card per course. Cards are sorted by most recent activity first (i.e. whichever course had something happen most recently floats to the top).

Each card contains:

**Header row**
- Course name and subject
- Status badge: Published / Draft / Archived

**Activity counters row**
A set of icon + number badges. Only badges with a count > 0 are shown — no empty placeholders.

| Icon | Meaning |
|---|---|
| Pen-and-paper | Submissions awaiting review |
| Exclamation mark | AI insights / alerts (e.g. student flagged as struggling) |
| Clock | Drafts or course elements awaiting teacher review |
| Envelope | Pending student invitations |

**Footer row**
- Student count enrolled
- A **"Open course"** link that navigates to the course's management page

## "Create new course" entry point

A dedicated card at the end of the grid (always last, regardless of sort) with a "+" icon and "Create new course" label. Clicking it starts the course creation wizard.

## What is intentionally excluded

- Aggregated task lists or a global inbox across courses
- Per-student details (those live inside the course analytics page)
- Any stats that don't represent something actionable (e.g. total students taught, total courses created)
