# Course Landing (`/course/:id`)

A static overview page the student can return to at any time. Its job is to answer three questions: what is this course, how is it structured, and why does it matter. On first visit it doubles as the entry point — the student starts the course from here.

## Layout

Same persistent left sidebar as the dashboard. Main content area is a single scrollable column — no heavy grid layout. This page is meant to be read, not scanned.

## Main content area — sections

**1. Course header**
- Course name, subject, and teacher name
- A short (2–4 sentence) description of the course written or approved by the teacher — the "pitch": what the student will be able to do after completing it, framed in real-world terms
- Overall progress bar (hidden on first visit before any module is started)
- **"Continue"** CTA (or **"Start course"** on first visit), prominently placed

**2. Module list**
An ordered list of all modules in the course. Each module row shows:
- Module number and name
- One-line description of what the module covers
- Completion state: locked / available / in progress / completed
- For the current in-progress module: progress within it (e.g. "4 of 9 concepts complete")
- Clicking an available or in-progress module navigates to its module landing page

Locked modules are visible but not clickable — students can see where the course is going without being able to skip ahead.

**3. Learning objectives**
A clean list of the overall skills the course develops (teacher-defined). Framed as outcomes: "By the end of this course, you will be able to…". Not a table — just a readable list.

## What is intentionally excluded

- Uploaded resource files (those are scoped to the module, not the course)
- Grades or scoring (lives in the grading interface)
- Any AI interaction (this is a static reference page)
