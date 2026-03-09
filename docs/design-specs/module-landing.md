# Module Landing (`/course/:id/module/:id`)

A two-column overview page the student sees before entering a module session. Combines contextual framing (left) with a visual map of what they're about to learn (right). The student can return to this page at any time during the module.

## Layout

Same persistent left sidebar. Main content area is split into two equal columns.

## Left column — Module context

- Module name and number
- **Why this module:** a short explanation of how this module's concepts connect to real-life use cases, framed in concrete terms (not abstract academic language)
- **Builds on:** one-line reference to the previous module and which specific concepts carry forward (omitted for the first module)
- **Leads into:** one-line reference to the next module and how this module sets it up (omitted for the last module)
- **Learning outcomes:** a clean list of the specific skills the student will have after completing this module, framed as "You will be able to…"

## Right column — Concept map

An ordered, vertical list of all concepts in the module. Each concept is a node showing:
- Concept name
- Completion state: locked / available / in progress / completed / due for review
- A subtle progress indicator for in-progress concepts (e.g. how many exercises answered correctly)

Concepts unlock sequentially — a locked concept is visible but its button is disabled. The student can see the full map without being able to skip ahead.

Clicking the button on an available or in-progress concept navigates directly to that concept's position in the learning session.

## Entry behavior

- A **"Enter module"** CTA is shown prominently (below the left column content, or as a sticky footer)
- Clicking **"Enter module"** or clicking the button on the first concept **for the first time only** takes the student into the chat interface, where the baseline assessment (3 prior knowledge questions) runs before any theory or exercises are shown
- On all subsequent visits, the same actions resume the session at the student's current position — no repeated baseline

## What is intentionally excluded

- Resources/uploaded materials (scoped to the session's materials panel)
- Points or scoring breakdown (not the focus of this page)
