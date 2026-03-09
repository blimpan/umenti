# Notifications (`/notifications`)

A chronological feed of events that require the student's attention or awareness. Teacher notifications are surfaced via dashboard badge counters, not this page — this page is student-facing only.

## Layout

Persistent left sidebar. Main content area is a single scrollable list.

## Notification types

| Type | Trigger | Action |
|---|---|---|
| Course invite | Teacher invites student to a course | "Join course" CTA |
| Homework assigned | Teacher creates a new homework assignment | "View homework" CTA — navigates to the relevant course dashboard card |
| Grade returned | Teacher sends feedback on a submission | "View feedback" CTA |
| Spaced repetition due | Concepts in the queue have gone overdue | "Start review" CTA |

## List behavior

- Unread notifications are visually distinct (e.g. bold or accent dot)
- Clicking a notification or its CTA marks it as read and navigates to the relevant page
- "Mark all as read" button at the top of the list
- No pagination for the prototype — full list is shown

## What is intentionally excluded

- Teacher notifications (surfaced via dashboard badge counters instead)
- Notification preferences / muting (future feature)
- Push or email notification settings (future feature)
