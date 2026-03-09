# Student Dashboard (`/dashboard`)

The student's home base between sessions. Action-first: the primary goal is to get the student back into a study session or address something urgent (homework due, spaced repetition overdue). Overview information is present but secondary and only shown if actionable.

## Layout

Persistent left sidebar (same as in the learning session, but always visible here — no cursor trick needed outside of the session). Main content area to the right.

## Main content area — sections

Sections are shown in this order. A section is omitted entirely if it has nothing to show.

**1. Urgent nudges (top of page, full width)**
A slim horizontal banner or a small stack of nudge cards. Only appears if at least one of the following is true:
- A homework assignment is due within 48 hours
- The spaced repetition queue has items overdue (i.e. last review was too long ago)

Each nudge is a single actionable line with a CTA button. Examples:
- "3 concepts due for review" → [Start review]
- "Homework for Algebra due tomorrow — 4 pts remaining" → [Continue]

No nudge banner = no wasted space at the top.

**2. Course cards (main section)**
All enrolled courses, sorted by most recently interacted with first. Each course gets a card containing:
- Course name and subject icon/color
- Current module name and progress within it (e.g. "Module 3 of 7 — Quadratic Equations")
- A progress bar showing overall course completion
- Homework status if an assignment is active (e.g. "Homework due Friday — 6/10 pts")
- A prominent **"Continue"** CTA button that resumes exactly where the student left off

Courses the student hasn't started yet show a **"Start"** button instead. Completed courses are visually muted and moved to the bottom.

**3. Spaced repetition queue (below course cards)**
Only shown if there are concepts queued for review. Displays as a single card (not per-course):
- Number of concepts due for review
- Which courses they span
- A **"Review now"** CTA

Not broken down concept-by-concept here — that detail lives in the session itself.

## Left sidebar contents (always visible on dashboard)

- App logo / home link
- Navigation: Dashboard, My Courses, Notifications
- Account / settings at bottom

## What is intentionally excluded

- Total points, streaks, time spent, or any stat that doesn't drive a next action
- Leaderboards or social comparison (not part of this platform's principles)
- A separate notifications section (handled on its own page)
