# Spaced Repetition Session (`/review`)

Not a separate page — reuses the student learning session interface (`/course/:id/module/:id/session`) with a different entry context and navigation behavior.

## How it works

The student enters from a "Review now" CTA on the dashboard or a nudge. The platform picks the first due concept from the queue and loads the learning session for the module that concept belongs to. The student has full access to the right materials panel (theory and resources for that module) as context.

Once the student proves comprehension by answering correctly, the session immediately advances to the next due concept in the queue — which may be from a different module or course. When it is, the module context updates: the materials panel switches to reflect the new module's theory and resources.

The session ends when the queue is empty. A completion message appears in the chat stream.

## What differs from a regular learning session

- Entry is from the review queue, not a specific module
- Progression is queue-driven, not linear within a module
- The left sidebar module list reflects the current concept's module but navigation away is discouraged (no "next module" prompts)
- No new theory blocks are shown — only the exercise for the due concept and any Socratic follow-up if the student answers incorrectly

## What is intentionally excluded

- A separate UI or page for spaced repetition — the learning session interface handles it
