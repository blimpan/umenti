# Course Creation Wizard (`/teacher/courses/new`)

A multi-step form for setting up a new course. Each step occupies its own screen. A progress bar at the top shows which step the teacher is on. The teacher can navigate back to previous steps freely. Progress is auto-saved so the teacher can leave and return without losing work.

## Progress bar steps

1. Basics
2. Structure
3. Materials *(optional)*
4. Review & Generate

---

## Step 1 — Basics

Fields:
- **Course name** — text input. E.g. "9th Grade Mathematics"
- **Subject** — dropdown or searchable select. E.g. "Mathematics"
- **Language** — dropdown. E.g. "Swedish", "English"
- **Target audience** — short text input. E.g. "Students aged 14–15"

Below the fields, a secondary option:
> "Import from official curriculum" — a link/button that opens a searchable modal letting the teacher select a pre-structured course from their country's national curriculum. Selecting one pre-fills all fields in steps 1 and 2, which the teacher can then edit.

CTA: **"Next"**

---

## Step 2 — Structure

This step defines the academic substance of the course. All list fields (modules, concepts, objectives, outcomes) support adding and removing items. Each field has an **"AI suggest"** button that generates suggestions based on what has been filled in so far — the teacher can accept, edit, or dismiss each suggestion individually.

Fields:
- **Modules** — an ordered list of module names. Teacher adds modules one by one. Each module can be expanded inline to add:
  - **Learning objectives** for the module (list) — the teacher's goals for this module (e.g. "Understanding market equilibrium")
  - **Learning outcomes** for the module (list) — the measurable proof of mastery (e.g. "Student can calculate the equilibrium price on a graph")

Concepts are **not** entered by the teacher — the LLM infers them from the module objectives, outcomes, subject, and target audience.

The AI suggest button is available at each level: suggest modules given the subject, suggest objectives/outcomes given the module name.

CTA: **"Next"**

---

## Step 3 — Materials *(optional)*

The teacher can upload existing learning material to be used by the AI tutor. Each uploaded file must be assigned to one or more modules.

- Drag-and-drop upload area
- Each uploaded file shows its name, type, and size
- A module selector (multi-select) appears per file
- Files can be removed before proceeding

If the teacher skips this step, the platform generates all theory from scratch based on the course structure.

CTA: **"Next"** and **"Skip"**

---

## Step 4 — Review & Generate

A read-only summary of everything filled in across steps 1–3. Organized in collapsible sections (Basics, Structure, Materials). The teacher can click "Edit" on any section to jump back to that step.

Below the summary:
- An **"AI evaluation"** button — triggers a quick AI review of the course structure. The AI response appears inline on this page as a short paragraph flagging any gaps, ambiguities, or suggestions. The teacher can dismiss it or use it to go back and revise.
- A **"Generate course"** primary CTA — submits the course for generation. The teacher is shown a confirmation screen explaining that generation may take a few minutes and the draft will appear in "My Courses" when ready. They are not kept on a loading screen.

## What is intentionally excluded

- Grading criteria setup (handled later in the course editor once content is generated)
- Student invitations (prompted after publishing, not during creation)
