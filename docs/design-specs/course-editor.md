# Course Editor (`/teacher/courses/:id/edit`)

Where the teacher reviews and iterates on AI-generated course content before publishing. Organized module-by-module to avoid overwhelming the teacher with a wall of content.

## Layout

A two-panel layout: a narrow left sidebar listing all modules, and a main content area showing the selected module's content.

## Left sidebar

- Course name and status badge (Draft / Published)
- Ordered list of module names, each with a review status indicator:
  - Unreviewed (default after generation)
  - In review
  - Approved
- Clicking a module loads it in the main content area
- **"Publish course"** CTA at the bottom, disabled until at least one module is approved. Clicking it prompts the teacher to invite students if none have been added yet.

## Main content area — per module

The selected module's content is displayed as an ordered sequence of sections:

**Module overview section**
- Editable fields: module title, why-this-module description, builds-on text, leads-into text, learning outcomes list
- Each field has an inline edit button. Clicking it makes the field editable in place.

**Concept sections (one per concept)**
Each concept section contains:
- Concept name (editable)
- **Theory block(s):** the generated theory text for this concept. Editable inline.
- **Exercise(s):** each exercise shown as a card with the question, answer format, and correct answer/rubric. Editable inline.

**Per-element AI revision**
Every theory block and exercise has a comment-and-send button. Clicking it opens a small input where the teacher writes a note (e.g. "This explanation is too abstract — use a football analogy") and submits it. The element is then flagged as "Pending AI revision" and updates when the AI has rewritten it. The teacher can accept or reject the revision.

**Module actions (sticky footer)**
- **"Mark as approved"** — marks the module reviewed and updates the sidebar indicator
- **"Add concept"** — appends a new blank concept section at the end of the module

## What is intentionally excluded

- Student-facing preview (not in scope for initial version)
- Bulk AI regeneration of the entire course (changes are per-element to keep the teacher in control)
