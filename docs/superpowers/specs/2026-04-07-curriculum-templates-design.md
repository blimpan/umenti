# Curriculum Templates — Design Spec

**Date:** 2026-04-07
**Status:** Approved

---

## Context

National school curricula are public and standardised — a Grade 10 maths course in Stockholm follows the same structure as one in Gothenburg. Teachers currently have to recreate this structure from scratch in the course wizard, which is redundant busywork.

This feature lets teachers select a pre-structured curriculum template (country → subject → course) and have the wizard pre-fill all fields — name, subject, language, target audience, modules, objectives, and outcomes. The teacher can then edit anything before generating. This is the "customize" path. A future "use as-is" path (clone a fully-generated vetted course) is out of scope here but the data model is designed to accommodate it without structural changes.

---

## Scope

**In scope:**
- New wizard step 0 (Start) — choose template or scratch
- New wizard step 1 (Template) — cascading country/subject/course dropdowns with module preview
- Full pre-fill of all wizard fields from the selected template
- `CurriculumTemplate` DB model and seed infrastructure
- `GET /api/templates/meta` and `GET /api/templates/:id` endpoints
- `/create-curriculum-template` developer skill for seeding templates from raw curriculum text

**Out of scope:**
- "Use as-is" path (clone vetted full course) — future feature
- Admin UI for managing templates
- Teacher-created templates

---

## Data Model

Four new Prisma models. Template data is read-only reference data, entirely separate from the course domain.

```prisma
model CurriculumTemplate {
  id             Int                      @id @default(autoincrement())
  country        String
  subject        String
  grade          String
  name           String                   // e.g. "Matematik 2b"
  language       String
  targetAudience String
  modules        CurriculumTemplateModule[]

  @@index([country, subject])
}

model CurriculumTemplateModule {
  id         Int                    @id @default(autoincrement())
  templateId Int
  template   CurriculumTemplate     @relation(fields: [templateId], references: [id], onDelete: Cascade)
  name       String
  order      Int
  objectives TemplateObjective[]
  outcomes   TemplateOutcome[]
}

model TemplateObjective {
  id       Int                      @id @default(autoincrement())
  moduleId Int
  module   CurriculumTemplateModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  text     String
}

model TemplateOutcome {
  id       Int                      @id @default(autoincrement())
  moduleId Int
  module   CurriculumTemplateModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  text     String
}
```

`onDelete: Cascade` on all relations — deleting a template cleans up all nested records automatically.

**Future "use as-is" extension** — when that path is built, add a single nullable FK to `CurriculumTemplate`:
```prisma
canonicalCourseId Int?   @unique
canonicalCourse   Course? @relation(fields: [canonicalCourseId], references: [id])
```
No other model changes needed.

---

## API

New router: `apps/api/src/routes/templates.ts`, registered at `/api/templates` in `index.ts`.

### `GET /api/templates/meta`

No auth required — public reference data.

Returns lightweight cascade data for the three dropdowns. No module objectives/outcomes included.

Response type (add to `packages/types`):
```ts
type TemplateMetaItem = {
  country: string
  subjects: {
    subject: string
    templates: { id: number; name: string; grade: string }[]
  }[]
}

type GetTemplatesMetaResponse = TemplateMetaItem[]
```

Add `Cache-Control: public, max-age=3600` — template data changes only when re-seeded.

### `GET /api/templates/:id`

No auth required.

Returns the full template including all modules, objectives, and outcomes. Used to pre-fill the wizard after the teacher confirms their selection.

Response type:
```ts
type CurriculumTemplateFull = {
  id: number
  country: string
  subject: string
  grade: string
  name: string
  language: string
  targetAudience: string
  modules: {
    name: string
    order: number
    objectives: { text: string }[]
    outcomes: { text: string }[]
  }[]
}
```

---

## Wizard UX

### Step flow

**Template path:** Start → Template → Basics → Structure → Materials → Review (6 steps)

**Scratch path:** Start → Basics → Structure → Materials → Review (5 steps)

`WizardProgress` shows labels for the active path. The Template step is omitted from the progress bar on the scratch path.

### New components

**`StepStart`**
- Two cards: "Use a curriculum template" / "Build from scratch"
- Calls `onSelectTemplate()` or `onSelectScratch()` — sets `useTemplate: boolean` state in `CourseWizard`
- No form fields

**`StepTemplate`**
- Three cascading dropdowns: Country → Subject → Course
- Fetches `GET /api/templates/meta` on mount — populates all three dropdowns
- On third dropdown change: fires `GET /api/templates/:id` in background, stores result in local state
- Shows module name preview once a template is selected
- Shows a loading indicator while `/meta` is fetching on mount; dropdowns are disabled until data arrives
- On "Use this template →": calls `onConfirm(template)` — triggers pre-fill in `CourseWizard`
- By the time the teacher confirms, the full template data is already loaded (preloaded during the natural reading pause)
- If the teacher goes Back to this step and selects a different template, `applyTemplate` re-runs and overwrites the previous pre-fill

### Pre-fill logic (in `CourseWizard`)

```ts
function applyTemplate(template: CurriculumTemplateFull) {
  form.setValue('name', template.name)
  form.setValue('subject', template.subject)
  form.setValue('language', template.language)
  form.setValue('targetAudience', template.targetAudience)
  form.setValue('modules', template.modules.map(m => ({
    id: crypto.randomUUID(),
    name: m.name,
    objectives: m.objectives.map(o => ({ id: crypto.randomUUID(), text: o.text })),
    outcomes:   m.outcomes.map(o => ({
      id: crypto.randomUUID(),
      text: o.text,
      objectiveIds: [],
    })),
  })))
}
```

### UI consistency

The Basics and Structure steps render identically regardless of path — no "pre-filled" labels or special styling. Pre-filled fields just have values. The teacher edits them as normal.

---

## Template Creation Skill

**Name:** `create-curriculum-template`

**Purpose:** Developer tool for seeding templates from raw curriculum text. Not teacher-facing.

**Workflow:**
1. Gather raw text from an official source (Skolverket, ministry PDF, etc.)
2. Run `/create-curriculum-template` in Claude Code, provide the text (pasted inline or file path)
3. Claude extracts structure and outputs a TypeScript seed object
4. Review and paste into `prisma/seed.ts`

**Output format** (matches Prisma nested create syntax):
```ts
{
  country: 'Sweden',
  subject: 'Mathematics',
  grade: 'Grade 10',
  name: 'Matematik 2b',
  language: 'Swedish',
  targetAudience: 'Students aged 15–16',
  modules: {
    create: [
      {
        name: 'Algebra',
        order: 0,
        objectives: { create: [{ text: 'Understand polynomial expressions' }] },
        outcomes:   { create: [{ text: 'Student can expand and factor quadratics' }] },
      },
    ]
  }
}
```

The skill encodes the distinction between objectives (learning goals) and outcomes (measurable proofs of mastery), normalising raw curriculum language into the platform's format. Handles multiple templates in one pass — feed an entire curriculum page and get an array of objects.

---

## Files Affected

| File | Change |
|------|--------|
| `apps/api/prisma/schema.prisma` | Add 4 new models |
| `apps/api/prisma/migrations/` | New migration |
| `apps/api/prisma/seed.ts` | Seed initial templates |
| `apps/api/src/routes/templates.ts` | New router (create) |
| `apps/api/src/index.ts` | Register `/api/templates` |
| `packages/types/src/index.ts` | Add `GetTemplatesMetaResponse`, `CurriculumTemplateFull` |
| `apps/web/src/components/wizard/CourseWizard.tsx` | Add `useTemplate` state, branching step logic, `applyTemplate` |
| `apps/web/src/components/wizard/WizardProgress.tsx` | Path-aware step labels |
| `apps/web/src/components/wizard/StepStart.tsx` | New component |
| `apps/web/src/components/wizard/StepTemplate.tsx` | New component |
| `.claude/skills/create-curriculum-template.md` | New skill (user-level Claude Code skill) |

---

## Verification

1. Run `pnpm prisma migrate dev` — migration applies cleanly
2. Run `pnpm prisma db seed` — templates appear in DB
3. `GET /api/templates/meta` returns cascade structure
4. `GET /api/templates/:id` returns full template with modules
5. In wizard: pick "Use a curriculum template" → select Sweden/Mathematics/Matematik 2b → confirm → Basics and Structure are pre-filled with correct values
6. All pre-filled fields are editable — change the course name, delete a module, add an objective
7. Submit the wizard normally — course is created and generation fires
8. Pick "Build from scratch" on Start step — wizard behaves identically to today
