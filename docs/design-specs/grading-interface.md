# Grading Interface (`/teacher/courses/:id/grading`)

Where the teacher reviews and finalizes AI-assisted grading of student submissions. The AI does the initial screening; the teacher verifies, corrects, and approves before feedback reaches the student.

## Layout

Two-panel layout: a narrow left sidebar listing all submissions, and a main content area showing the selected submission.

## Left sidebar

- Course name
- Filter tabs: All / Pending / Reviewed
- List of submissions, each showing:
  - Student name
  - Assignment name
  - Submission date
  - Status badge: Pending review / Reviewed
- Submissions sorted by date ascending (oldest first) so the teacher works through the backlog in order

## Main content area — per submission

**Header**
- Student name and assignment name
- Submission date
- Status badge

**Submission content**
The student's submitted work displayed in full. Read-only.

**AI review panel (shown immediately below the submission)**
The AI's initial screening, structured as:
- **Suggested grade** — the AI's recommended grade with a one-sentence justification
- **AI comments** — an ordered list of inline observations, each tied to a specific part of the submission (e.g. "This paragraph is poorly structured and doesn't connect with the previous one"). Each comment has a small label indicating whether it is positive, constructive, or flagging an error.

The teacher can:
- **Keep** an AI comment as-is (included in feedback sent to student)
- **Edit** an AI comment inline before keeping it
- **Dismiss** an AI comment (excluded from feedback)

**Teacher's own comments**
A text input below the AI review panel where the teacher can add their own comments not covered by the AI. These are always included in the feedback.

**Grade field**
An editable field pre-filled with the AI's suggested grade. The teacher confirms or overrides it.

**Submit actions (sticky footer)**
- **"Send feedback"** — finalizes the grade and comments and makes them visible to the student. Marks the submission as Reviewed.
- **"Save draft"** — saves progress without sending to the student.

## What is intentionally excluded

- Side-by-side diff view of student drafts (future feature)
- Bulk grading actions (future feature)
- Rubric builder (grading criteria are defined in the course editor, not here)
