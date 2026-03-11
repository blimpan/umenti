# Course Generation

How teacher input from the creation wizard is transformed into fully-structured course content via LLM.

---

## 1. Curriculum data model

The core structure is a curriculum alignment graph. Understanding this is key to understanding the whole platform.

```
Module
  └── LearningObjective   ("Understanding market equilibrium")
            ↕ M:M
      LearningOutcome     ("Student can calculate the equilibrium price on a graph")
            ↕ M:M
        Concept           ("Demand curves", "Supply curves", "Price points")  ← canonical at course scope
                └── TheoryBlock  (generated markdown paragraph)
                └── Exercise (multiple_choice or free_text)
                      ↕ M:M (at least one)
                  Concept
```

An exercise must test at least one concept, and can span multiple — e.g. "Calculate equilibrium when both curves shift" tests both "Demand curves" and "Supply curves" simultaneously.

Exercises are module-scoped: each exercise belongs to exactly one module and only tests concepts mapped to that module.

**Why M:M and not a strict tree?**
- One outcome can prove multiple objectives (e.g. "can calculate equilibrium" satisfies both "understand supply" and "understand demand")
- One concept can underpin multiple outcomes (e.g. "Demand curves" is needed for several measurable skills)

This graph structure also drives mastery tracking: when all concepts tied to an outcome are mastered → outcome achieved → check all outcomes for an objective → objective complete.

**Note on course-level objectives:** Objectives belong to modules. Course-level understanding is derived — it is the union of all module objectives. The wizard collects objectives per module (not as a separate course-level list).

**Note on concept identity:** Concepts are canonical at the course level — a `Concept` record belongs to a `Course`, not a `Module`. `ModuleConcept` is the join that places a concept in a module with its display order. If the same concept appears in module 1 and module 3, it is one record: student mastery, spaced repetition history, and comprehension scores are all tracked against that single ID.

---

## 2. Wizard input contract

When the teacher completes the wizard, the following payload is submitted to `POST /api/courses`:

IDs within the wizard payload are client-generated UUIDs (assigned in the browser as the teacher fills out the form). This keeps relationships stable if items are reordered before submission.

```ts
type CourseWizardInput = {
  name: string               // "Introduction to Economics"
  subject: string            // "Economics"
  language: string           // "English"
  targetAudience: string     // "Students aged 14–15"

  modules: {
    id: string               // client-generated UUID
    name: string
    objectives: {
      id: string
      text: string           // "Understanding market equilibrium"
    }[]
    outcomes: {
      id: string
      text: string           // "Student can calculate the equilibrium price on a graph"
      objectiveIds: string[] // which objectives this outcome contributes to
    }[]
    // Concepts are NOT provided by the teacher — the LLM infers them from
    // subject, module objectives/outcomes, and targetAudience.
  }[]

  teacherMaterials: (
    {
      type: 'file'
      filename: string
      storageKey: string     // key in object storage (e.g. Supabase Storage)
      moduleIds: string[]    // which modules this file applies to
    }
    | {
      type: 'link'
      title: string
      url: string            // e.g. YouTube video or online article
      moduleIds: string[]    // which modules this link applies to
    }
  )[]
}
```

Note: concepts are a flat list within the module (not nested under outcomes) because the M:M relationship means a concept may belong to several outcomes — nesting would require duplication.

---

## 3. Generation pipeline (2-pass, module-sequential)

Generation is async. The teacher is redirected immediately after submitting; the course appears in "My Courses" with status `GENERATING` until complete.

### Pass 1 — Course skeleton

One LLM call. Input: the full `CourseWizardInput`.

For each module, generates a narrative that gives it its position in the course arc:

```ts
type ModuleSkeleton = {
  moduleId: string        // references the client-generated module UUID
  whyThisModule: string   // why this module matters in the broader course
  buildsOn: string        // what prior knowledge or module it builds on
  leadsInto: string       // what comes next and why
}
```

Written to the DB immediately. Gives Pass 2 cross-module context so generated theory is coherent (e.g. "this is where students first encounter quadratics, referenced again in Module 5").

### Pass 2 — Module generation (in order)

Modules are generated sequentially (`module 1 -> module 2 -> ...`) to preserve pedagogical flow and stable concept identity.

For each module, run these steps in order:

1. Concept resolution and merge
- Resolve each module concept to a canonical `Concept` ID.
- If a concept is semantically equivalent to an existing concept from a previous module, reuse that ID.
- If no equivalent concept exists, create a new canonical concept.

2. Theory generation (concept-level)
- Generate theory blocks for the module's resolved concept IDs.
- Input includes module outcomes/objectives, module skeleton, and extracted `teacherMaterials` content.
- The generated payload exposes theory as an ordered array of markdown paragraphs (`theoryBlocks: string[]`) per concept. Each element maps directly to one `TheoryBlock` DB record.

3. Exercise generation (module-level)
- Generate exercises for this module only.
- Allowed concept links are restricted to concepts mapped to this module.
- Associate each exercise to the concept entries it tests in the generated module payload.

Output per module:

```ts
type GeneratedModule = {
  concepts: {
    id: string             // canonical concept ID (resolved or newly created)
    theoryBlocks: string[] // ordered markdown paragraphs → one TheoryBlock record each
  }[]
  exercises: (Exercise & { conceptIds: [string, ...string[]] })[]  // at least one concept ID required
}
```

---

## 4. Exercise types (v1)

```ts
type MultipleChoiceExercise = {
  type: 'multiple_choice'
  conceptIds: [string, ...string[]]          // at least one concept this exercise tests
  question: string
  options: [string, string, string, string]  // exactly 4
  correctIndex: 0 | 1 | 2 | 3
  explanation: string                        // shown to student after answering
}

type FreeTextExercise = {
  type: 'free_text'
  conceptIds: [string, ...string[]]  // at least one concept this exercise tests
  question: string
  sampleAnswer: string               // reference answer used by grading LLM
  rubric: string                     // criteria for what makes a good answer
}

type Exercise = MultipleChoiceExercise | FreeTextExercise
```

The `type` discriminant makes it safe to narrow in both TypeScript and UI rendering (the exercise card switches on `type`).

---

## 5. Database schema

See `apps/api/prisma/schema.prisma` for the full Prisma model definitions.

### Models

- `Course` — top-level record, owned by a teacher. Holds name/subject/language/targetAudience + generation status.
- `CourseModule` — one per module. Holds skeleton output (whyThisModule, buildsOn, leadsInto) + review status.
- `LearningObjective` — belongs to a module. The teacher's stated goal.
- `LearningOutcome` — measurable proof of mastery. M:M with objectives (join: `OutcomeObjective`).
- `Concept` — canonical content unit at **course** scope (belongs to `Course`, not `Module`). M:M with outcomes (join: `ConceptOutcome`). One record per real-world concept — reused across modules when semantically equivalent.
- `ModuleConcept` — join table mapping concepts to modules, including per-module ordering.
- `TheoryBlock` — one markdown paragraph. Belongs to a concept. Ordered.
- `Exercise` — one per exercise, owned by exactly one module. `type` enum drives which fields are populated. MC options stored as JSON. M:M with concepts (join: `ExerciseConcept`) limited to concepts mapped to the same module.
- `CourseMaterial` — teacher-provided source material (`file` or `link`). `CourseMaterialModule` join table maps it to modules.

### Generation status enum

```
GENERATING → DRAFT → PUBLISHED → ARCHIVED
```

### Module review status enum (used in course editor)

```
UNREVIEWED → IN_REVIEW → APPROVED
```

### Inline revision flag

`TheoryBlock` and `Exercise` each have a `pendingRevision: Boolean` field. Set to `true` when the teacher submits an inline revision request; cleared when the AI rewrites and the teacher accepts.

---

## 6. API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/courses` | Submit wizard — creates Course + triggers generation |
| `GET` | `/api/courses` | List teacher's courses (dashboard) |
| `GET` | `/api/courses/:id` | Full course with all modules, concepts, theory, exercises — **v1 only**; will need per-module fetching as courses grow |
| `PATCH` | `/api/courses/:id/modules/:moduleId` | Update module fields (editor inline edit) |
| `POST` | `/api/courses/:id/modules/:moduleId/concepts/:conceptId/theory/:blockId/revise` | Request AI revision of a theory block |
| `POST` | `/api/courses/:id/modules/:moduleId/concepts/:conceptId/exercises/:exerciseId/revise` | Request AI revision of an exercise |

---

## 7. What the LLM is NOT asked to do

- Name the module, concepts, or objectives — teacher provides these
- Define the module structure, objectives, or outcomes — teacher owns the curriculum shape
- Infer concepts without grounding — concept inference is always based on subject, module objectives/outcomes, and targetAudience provided by the teacher
- Set difficulty — it infers from `targetAudience`
- Generate grading criteria for homework assignments — that's set up in the course editor post-generation
