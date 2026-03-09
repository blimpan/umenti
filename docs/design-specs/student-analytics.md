# Student Analytics (`/teacher/courses/:id/analytics`)

A simple overview of all students enrolled in a course and their progress. Scoped to per-student summaries for the prototype. Class-wide aggregation is a future feature built on top of this data.

## Layout

Persistent left sidebar (same as teacher dashboard). Main content area is a single scrollable table or list of students.

## Main content area

**Page header**
- Course name
- Total students enrolled

**Student list**
One row per student, showing:
- Student name and profile picture
- Course completion percentage (e.g. "42% complete")
- Current module (e.g. "Module 3 — Quadratic Equations")
- Total time online in the course
- Last active date

Rows are sorted by last active date descending (most recently active first) by default. The teacher can re-sort by any column.

## What is intentionally excluded

- Concept-level comprehension breakdown (future feature)
- Class-wide aggregated insights (future feature — depends on per-student data existing first)
- Grades or submission status (those live in the grading interface)
