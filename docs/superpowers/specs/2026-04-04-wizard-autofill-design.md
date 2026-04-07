# Wizard Autofill — Design Spec
_Date: 2026-04-04_

## Problem

The course creation wizard has 7+ text fields across two steps. Teachers fill them manually with no AI assistance until the final "Generate" step. Adding inline suggestions at the field level would speed up wizard completion and surface good defaults.

## Intended Outcome

Each empty text field in the wizard auto-triggers an LLM suggestion after 2 seconds of focus. The suggestion appears as gray ghost text (VSCode-style inline completion). Pressing Tab accepts it into the field. Previously filled form values are used as context for the suggestion.

---

## Architecture

### Backend — `POST /api/wizard/suggest`

**New file:** `apps/api/src/routes/wizard.ts`  
**Registered in:** `apps/api/src/index.ts` as `app.use('/api/wizard', wizardRouter)`  
**Auth:** `requireAuth` middleware

**Request body:**
```typescript
{
  field: string               // see field names below
  context: WizardSuggestContext
}
```

**Response:**
```typescript
{ suggestion: string }
```

**LLM call:** `getModel()` + `generateText()` (plain text, no Zod schema). Each `field` value maps to a targeted prompt that uses the provided context. No structured output needed — the response is a single short string. The backend trims the result and strips any surrounding quotation marks before returning it.

**Field → context mapping:**

| `field` value | Context used | Prompt intent |
|---|---|---|
| `name` | `language` | Suggest a course name |
| `subject` | `name` | Suggest a subject for this course |
| `targetAudience` | `name`, `subject`, `language` | Suggest a student demographic |
| `module.name` | `name`, `subject`, `targetAudience`, `existingModuleNames` | Suggest a module name that doesn't overlap existing ones |
| `module.objective` | `name`, `subject`, `moduleName` | Suggest a learning objective for this module |
| `module.outcome` | `name`, `subject`, `moduleName`, `existingObjectives` | Suggest a measurable outcome given the objectives |

---

### Shared Types — `packages/types/src/index.ts`

```typescript
export type WizardSuggestContext = {
  name?: string
  subject?: string
  language?: string
  targetAudience?: string
  moduleName?: string
  existingObjectives?: string[]
  existingModuleNames?: string[]
}

export type WizardSuggestRequest = {
  field: string
  context: WizardSuggestContext
}

export type WizardSuggestResponse = {
  suggestion: string
}
```

---

### Frontend — `SuggestedInput` component

**New file:** `apps/web/src/components/wizard/SuggestedInput.tsx`

Wraps the existing Shadcn `Input`. Fully self-contained — no suggestion logic leaks into step components.

**Props:**
```typescript
interface SuggestedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  field: string                          // matches backend field names
  context: WizardSuggestContext          // form values available at the call site
  onAccept: (value: string) => void      // calls RHF setValue on Tab-accept
}
```

**Behavior:**
- `onFocus`: if value is empty, start a 2s timer (also restarts the timer if the field is re-focused while still empty)
- Timer fires: `POST /api/wizard/suggest` with `{ field, context }`
- Suggestion ready: set `placeholder={suggestion}` on the underlying `Input`; render `"Tab ↵ to accept"` hint below
- `onChange`: cancel timer, clear suggestion state (user is typing)
- `onBlur`: cancel timer, clear suggestion state (no background fetches; timer resets on next focus)
- `onKeyDown Tab` (when suggestion exists): call `onAccept(suggestion)`, `e.preventDefault()`, clear suggestion

**No loading indicator** — fetch is silent. The hint only appears when the suggestion is ready.

---

### Integration — fields updated

| File | Fields swapped to `SuggestedInput` |
|---|---|
| `apps/web/src/components/wizard/StepBasics.tsx` | `name`, `subject`, `targetAudience` |
| `apps/web/src/components/wizard/ModuleItem.tsx` | `modules[i].name`, `modules[i].objectives[j]`, `modules[i].outcomes[j]` |

`language` is a `<Select>` — unchanged.  
`StepMaterials` and `StepReview` have no editable text fields — unchanged.

**Context construction per call site:**

- `name` → `{ language: watch('language') }`
- `subject` → `{ name: watch('name') }`
- `targetAudience` → `{ name, subject, language }`
- `module.name` → `{ name, subject, targetAudience, existingModuleNames: modules.map(m => m.name) }`
- `module.objective` → `{ name, subject, moduleName: module.name }`
- `module.outcome` → `{ name, subject, moduleName: module.name, existingObjectives: module.objectives.map(o => o.text) }`

`StepBasics` uses `watch()` from RHF for the context values it already has access to. `ModuleItem` receives `{ name, subject, targetAudience }` as props from `StepStructure`, which already has them via `watch()`.

---

## Verification

1. Open wizard at `/teacher/courses/new`
2. Focus the **Course name** field — after 2s, gray ghost text appears as placeholder
3. Press **Tab** — field fills with the suggestion
4. Type something in **Subject** then clear it — ghost text appears after 2s
5. Type before 2s fires — no suggestion appears
6. Blur the field before 2s — no fetch is made (check Network tab)
7. Add a module in Step 2, focus the module name field — ghost text uses course name/subject/audience as context
8. Check that `language` dropdown and read-only fields in Steps 3–4 are unaffected
