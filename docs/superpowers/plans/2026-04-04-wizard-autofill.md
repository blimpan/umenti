# Wizard Autofill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add VSCode-style ghost-text suggestions to all text fields in the course creation wizard — after 2 seconds of focus on an empty field, a gray suggestion auto-appears that the teacher can Tab-accept.

**Architecture:** A new `SuggestedInput` component wraps the existing Shadcn `Input`, self-managing a 2s timer, a silent fetch to `POST /api/wizard/suggest`, and a Tab-accept handler. The backend endpoint switch-cases on a `field` string to build a targeted LLM prompt using the context values sent from the form. `setValue` is threaded from `StepStructure` to `ModuleItem` as a prop (not derivable from `Control` alone). No new state management layer — React Hook Form's `setValue` and `watch` are used throughout.

**Tech Stack:** React, React Hook Form (`useWatch`, `UseFormSetValue`), Shadcn `Input`, Vitest (backend only — no frontend test runner configured), `ai` SDK (`generateText`), Express + `requireAuth`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/types/src/index.ts` | Modify | Add `WizardSuggestContext`, `WizardSuggestRequest`, `WizardSuggestResponse` |
| `apps/api/src/routes/wizard.ts` | Create | `POST /suggest` endpoint + exported `buildPrompt` |
| `apps/api/src/routes/wizard.test.ts` | Create | Unit tests for `buildPrompt` |
| `apps/api/src/index.ts` | Modify | Register `wizardRouter` |
| `apps/web/src/components/wizard/SuggestedInput.tsx` | Create | Ghost-text input wrapper |
| `apps/web/src/components/wizard/StepBasics.tsx` | Modify | Swap 3 `Input` for `SuggestedInput` |
| `apps/web/src/components/wizard/StepStructure.tsx` | Modify | Watch course fields, pass `courseContext` + `setValue` to `ModuleItem` |
| `apps/web/src/components/wizard/ModuleItem.tsx` | Modify | Accept `courseContext` + `setValue`, use `useWatch`, swap inputs |

---

## Task 1: Shared types

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Add the three types**

In `packages/types/src/index.ts`, append after the `CourseWizardInput` type (before `CreateCourseResponse`):

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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/linus/Coding/metis && pnpm --filter @metis/types build 2>&1 | tail -5
```

Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat: add wizard suggest types"
```

---

## Task 2: Backend route (TDD)

**Files:**
- Create: `apps/api/src/routes/wizard.ts`
- Create: `apps/api/src/routes/wizard.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/routes/wizard.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildPrompt } from './wizard'

describe('buildPrompt()', () => {
  it('returns null for an unknown field', () => {
    expect(buildPrompt('unknown', {})).toBeNull()
  })

  it('name prompt mentions language when provided', () => {
    const prompt = buildPrompt('name', { language: 'Swedish' })
    expect(prompt).not.toBeNull()
    expect(prompt).toContain('Swedish')
  })

  it('name prompt works without language', () => {
    expect(buildPrompt('name', {})).not.toBeNull()
  })

  it('subject prompt mentions course name', () => {
    const prompt = buildPrompt('subject', { name: 'Algebra Basics' })
    expect(prompt).toContain('Algebra Basics')
  })

  it('targetAudience prompt mentions name and subject', () => {
    const prompt = buildPrompt('targetAudience', { name: 'Algebra', subject: 'Mathematics' })
    expect(prompt).toContain('Algebra')
    expect(prompt).toContain('Mathematics')
  })

  it('module.name prompt lists existing modules', () => {
    const prompt = buildPrompt('module.name', {
      name: 'Algebra',
      subject: 'Math',
      targetAudience: 'Year 9',
      existingModuleNames: ['Variables', 'Equations'],
    })
    expect(prompt).toContain('Variables')
    expect(prompt).toContain('Equations')
  })

  it('module.objective prompt contains module name', () => {
    const prompt = buildPrompt('module.objective', {
      name: 'Algebra',
      subject: 'Math',
      moduleName: 'Variables & Expressions',
    })
    expect(prompt).toContain('Variables & Expressions')
  })

  it('module.outcome prompt lists existing objectives', () => {
    const prompt = buildPrompt('module.outcome', {
      name: 'Algebra',
      subject: 'Math',
      moduleName: 'Variables',
      existingObjectives: ['Understand what a variable is'],
    })
    expect(prompt).toContain('Understand what a variable is')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd apps/api && pnpm vitest run src/routes/wizard.test.ts 2>&1 | tail -10
```

Expected: `Cannot find module './wizard'` or similar import error.

- [ ] **Step 3: Implement the route**

Create `apps/api/src/routes/wizard.ts`:

```typescript
import { Router } from 'express'
import { generateText } from 'ai'
import { requireAuth } from '../middleware/auth'
import { getModel } from '../lib/llm'
import type { WizardSuggestContext, WizardSuggestRequest, WizardSuggestResponse } from '@metis/types'

const router = Router()

router.post('/suggest', requireAuth, async (req, res) => {
  const { field, context } = req.body as WizardSuggestRequest

  const prompt = buildPrompt(field, context)
  if (!prompt) {
    res.status(400).json({ error: `Unknown field: ${field}` })
    return
  }

  try {
    const { text } = await generateText({ model: getModel(), prompt })
    // Trim whitespace and strip surrounding quotes the LLM sometimes adds
    const suggestion = text.trim().replace(/^["']|["']$/g, '')
    const response: WizardSuggestResponse = { suggestion }
    res.json(response)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to generate suggestion' })
  }
})

export function buildPrompt(field: string, context: WizardSuggestContext): string | null {
  switch (field) {
    case 'name':
      return `Suggest a concise, descriptive course name${context.language ? ` taught in ${context.language}` : ''}. Reply with only the course name, nothing else.`

    case 'subject':
      return `Suggest a subject area for a course called "${context.name}". Reply with only the subject name, nothing else.`

    case 'targetAudience':
      return `Suggest a brief target audience description for a ${context.subject} course called "${context.name}"${context.language ? ` taught in ${context.language}` : ''}. Example format: "Students aged 14-15". Reply with only the description, nothing else.`

    case 'module.name': {
      const existingList = context.existingModuleNames?.filter(Boolean).join(', ')
      return `Suggest a module name for a ${context.subject} course called "${context.name}" targeting ${context.targetAudience}${existingList ? `. Existing modules: ${existingList}. Suggest something that does not overlap with these` : ''}. Reply with only the module name, nothing else.`
    }

    case 'module.objective':
      return `Suggest one learning objective for a module called "${context.moduleName}" in a ${context.subject} course called "${context.name}". A learning objective states what students should be able to do. Reply with only the objective, nothing else.`

    case 'module.outcome': {
      const objectives = context.existingObjectives?.filter(Boolean).join('; ')
      return `Suggest one measurable learning outcome for a module called "${context.moduleName}" in a ${context.subject} course${objectives ? `. Learning objectives for this module: ${objectives}` : ''}. A learning outcome is measurable evidence of mastery. Reply with only the outcome, nothing else.`
    }

    default:
      return null
  }
}

export default router
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd apps/api && pnpm vitest run src/routes/wizard.test.ts 2>&1 | tail -10
```

Expected: `8 passed`.

- [ ] **Step 5: Register the route in index.ts**

In `apps/api/src/index.ts`, add the import after the existing router imports:

```typescript
import wizardRouter from './routes/wizard'
```

Add the route registration after the other `app.use()` lines:

```typescript
app.use('/api/wizard', wizardRouter)
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/wizard.ts apps/api/src/routes/wizard.test.ts apps/api/src/index.ts
git commit -m "feat: add POST /api/wizard/suggest endpoint"
```

---

## Task 3: SuggestedInput component

**Files:**
- Create: `apps/web/src/components/wizard/SuggestedInput.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/wizard/SuggestedInput.tsx`:

```typescript
'use client'

import { useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import type { WizardSuggestContext, WizardSuggestResponse } from '@metis/types'

const API = process.env.NEXT_PUBLIC_API_URL

interface SuggestedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  field: string
  context: WizardSuggestContext
  onAccept: (value: string) => void
}

export default function SuggestedInput({
  field,
  context,
  onAccept,
  onFocus,
  onBlur,
  onChange,
  onKeyDown,
  ...props
}: SuggestedInputProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function cancelTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  async function fetchSuggestion() {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`${API}/api/wizard/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ field, context }),
      })

      if (!res.ok) return
      const data: WizardSuggestResponse = await res.json()
      setSuggestion(data.suggestion)
    } catch {
      // Silent failure — teacher sees nothing, can type normally
    }
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    onFocus?.(e)
    if (!e.target.value) {
      cancelTimer()
      timerRef.current = setTimeout(fetchSuggestion, 2000)
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    onBlur?.(e)
    cancelTimer()
    setSuggestion(null)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onChange?.(e)
    cancelTimer()
    setSuggestion(null)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab' && suggestion) {
      e.preventDefault()
      onAccept(suggestion)
      setSuggestion(null)
      return
    }
    onKeyDown?.(e)
  }

  return (
    <div className="relative">
      <Input
        {...props}
        placeholder={suggestion ?? (props.placeholder as string | undefined)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      {suggestion && (
        <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
          <kbd className="rounded border border-gray-300 bg-gray-100 px-1 font-mono text-[10px] text-gray-500">
            Tab
          </kbd>
          to accept
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | grep -i "error" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/wizard/SuggestedInput.tsx
git commit -m "feat: add SuggestedInput ghost-text component"
```

---

## Task 4: StepBasics — wire up 3 fields

**Files:**
- Modify: `apps/web/src/components/wizard/StepBasics.tsx`

- [ ] **Step 1: Replace StepBasics**

Replace the full contents of `apps/web/src/components/wizard/StepBasics.tsx`:

```typescript
'use client'

import { Controller, UseFormReturn } from 'react-hook-form'
import type { CourseWizardInput } from '@metis/types'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import SuggestedInput from './SuggestedInput'

const LANGUAGES = ['English', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'German', 'French', 'Spanish']

type Props = {
  form: UseFormReturn<CourseWizardInput>
  onNext: () => void
}

export default function StepBasics({ form, onNext }: Props) {
  const { register, control, formState: { errors }, watch, setValue } = form
  const name = watch('name')
  const subject = watch('subject')
  const language = watch('language')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Course basics</h2>
        <p className="text-sm text-gray-500 mt-1">Tell us what the course is about.</p>
      </div>

      <div className="space-y-4">
        <Field label="Course name" error={errors.name?.message}>
          <SuggestedInput
            {...register('name')}
            field="name"
            context={{ language }}
            placeholder="e.g. 9th Grade Mathematics"
            onAccept={(val) => setValue('name', val, { shouldValidate: true })}
          />
        </Field>

        <Field label="Subject" error={errors.subject?.message}>
          <SuggestedInput
            {...register('subject')}
            field="subject"
            context={{ name }}
            placeholder="e.g. Mathematics"
            onAccept={(val) => setValue('subject', val, { shouldValidate: true })}
          />
        </Field>

        <Field label="Language" error={errors.language?.message}>
          <Controller
            name="language"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a language" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Field label="Target audience" error={errors.targetAudience?.message}>
          <SuggestedInput
            {...register('targetAudience')}
            field="targetAudience"
            context={{ name, subject, language }}
            placeholder="e.g. Students aged 14-15"
            onAccept={(val) => setValue('targetAudience', val, { shouldValidate: true })}
          />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext}>Next</Button>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | grep -i "error" | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/wizard/StepBasics.tsx
git commit -m "feat: wire SuggestedInput into StepBasics"
```

---

## Task 5: StepStructure + ModuleItem — wire up module fields

**Files:**
- Modify: `apps/web/src/components/wizard/StepStructure.tsx`
- Modify: `apps/web/src/components/wizard/ModuleItem.tsx`

`setValue` is not accessible from `Control` directly — it is threaded as a prop from `StepStructure` to `ModuleItem`. Both files are fully replaced in this task.

- [ ] **Step 1: Replace StepStructure**

Replace the full contents of `apps/web/src/components/wizard/StepStructure.tsx`:

```typescript
'use client'

import { UseFormReturn, useFieldArray } from 'react-hook-form'
import type { CourseWizardInput } from '@metis/types'
import { Button } from '@/components/ui/button'
import ModuleItem from './ModuleItem'

type Props = {
  form: UseFormReturn<CourseWizardInput>
  onNext: () => void
  onBack: () => void
}

export default function StepStructure({ form, onNext, onBack }: Props) {
  const { control, register, formState: { errors }, watch, setValue } = form

  const { fields: modules, append, remove } = useFieldArray({
    control,
    name: 'modules',
  })

  const name = watch('name')
  const subject = watch('subject')
  const targetAudience = watch('targetAudience')
  const allModules = watch('modules')

  function handleAddModule() {
    append({
      id: crypto.randomUUID(),
      name: '',
      objectives: [],
      outcomes: [],
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Course structure</h2>
        <p className="text-sm text-gray-500 mt-1">
          Define your modules and what students should learn in each one.
          The AI will infer the specific concepts to cover.
        </p>
      </div>

      <div className="space-y-3">
        {modules.map((module, i) => (
          <ModuleItem
            key={module.id}
            nestIndex={i}
            control={control}
            register={register}
            errors={errors}
            onRemove={() => remove(i)}
            setValue={setValue}
            courseContext={{ name, subject, targetAudience }}
            existingModuleNames={allModules.map((m) => m.name).filter((_, idx) => idx !== i)}
          />
        ))}
      </div>

      {errors.modules && typeof errors.modules.message === 'string' && (
        <p className="text-xs text-red-500">{errors.modules.message}</p>
      )}

      <Button type="button" variant="outline" onClick={handleAddModule} className="w-full">
        + Add module
      </Button>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onNext}>Next</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace ModuleItem**

Replace the full contents of `apps/web/src/components/wizard/ModuleItem.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Control, FieldErrors, UseFormRegister, UseFormSetValue, useFieldArray, useWatch } from 'react-hook-form'
import type { CourseWizardInput } from '@metis/types'
import { Button } from '@/components/ui/button'
import SuggestedInput from './SuggestedInput'

type Props = {
  nestIndex: number
  control: Control<CourseWizardInput>
  register: UseFormRegister<CourseWizardInput>
  errors: FieldErrors<CourseWizardInput>
  onRemove: () => void
  setValue: UseFormSetValue<CourseWizardInput>
  courseContext: { name: string; subject: string; targetAudience: string }
  existingModuleNames: string[]
}

export default function ModuleItem({
  nestIndex,
  control,
  register,
  errors,
  onRemove,
  setValue,
  courseContext,
  existingModuleNames,
}: Props) {
  const [expanded, setExpanded] = useState(true)

  const { fields: objectives, append: appendObjective, remove: removeObjective } = useFieldArray({
    control,
    name: `modules.${nestIndex}.objectives`,
  })

  const { fields: outcomes, append: appendOutcome, remove: removeOutcome } = useFieldArray({
    control,
    name: `modules.${nestIndex}.outcomes`,
  })

  const moduleName = useWatch({ control, name: `modules.${nestIndex}.name` }) ?? ''
  const currentObjectives = useWatch({ control, name: `modules.${nestIndex}.objectives` }) ?? []

  const moduleErrors = errors.modules?.[nestIndex]

  return (
    <div className="border border-gray-200 rounded-lg">
      {/* Module header */}
      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-gray-400 hover:text-gray-600 transition-colors text-sm w-4"
        >
          {expanded ? '▾' : '▸'}
        </button>
        <SuggestedInput
          {...register(`modules.${nestIndex}.name`)}
          field="module.name"
          context={{ ...courseContext, existingModuleNames }}
          placeholder="Module name, e.g. Market Equilibrium"
          className="flex-1"
          onAccept={(val) =>
            setValue(`modules.${nestIndex}.name`, val, { shouldValidate: true })
          }
        />
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-300 hover:text-red-400 transition-colors text-sm"
        >
          ✕
        </button>
      </div>

      {/* Module error */}
      {moduleErrors?.name && (
        <p className="px-4 pb-2 text-xs text-red-500">{moduleErrors.name.message}</p>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-5 border-t border-gray-100 pt-4">
          {/* Objectives */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Learning objectives</p>
            <p className="text-xs text-gray-400">What is the goal of this module?</p>
            {objectives.map((obj, i) => (
              <div key={obj.id} className="flex items-center gap-2">
                <SuggestedInput
                  {...register(`modules.${nestIndex}.objectives.${i}.text`)}
                  field="module.objective"
                  context={{ ...courseContext, moduleName }}
                  placeholder="e.g. Understanding market equilibrium"
                  className="flex-1"
                  onAccept={(val) =>
                    setValue(`modules.${nestIndex}.objectives.${i}.text`, val, {
                      shouldValidate: true,
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() => removeObjective(i)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
            {moduleErrors?.objectives && (
              <p className="text-xs text-red-500">
                {typeof moduleErrors.objectives.message === 'string'
                  ? moduleErrors.objectives.message
                  : 'Define at least one learning objective. It can not be empty.'}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendObjective({ id: crypto.randomUUID(), text: '' })}
            >
              + Add objective
            </Button>
          </div>

          {/* Outcomes */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Learning outcomes</p>
            <p className="text-xs text-gray-400">How will mastery be measured?</p>
            {outcomes.map((outcome, i) => (
              <div key={outcome.id} className="flex items-center gap-2">
                <SuggestedInput
                  {...register(`modules.${nestIndex}.outcomes.${i}.text`)}
                  field="module.outcome"
                  context={{
                    ...courseContext,
                    moduleName,
                    existingObjectives: currentObjectives.map((o) => o.text),
                  }}
                  placeholder="e.g. Student can calculate the equilibrium price on a graph"
                  className="flex-1"
                  onAccept={(val) =>
                    setValue(`modules.${nestIndex}.outcomes.${i}.text`, val, {
                      shouldValidate: true,
                    })
                  }
                />
                <button
                  type="button"
                  onClick={() => removeOutcome(i)}
                  className="text-gray-300 hover:text-red-400 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            ))}
            {moduleErrors?.outcomes && (
              <p className="text-xs text-red-500">
                {typeof moduleErrors.outcomes.message === 'string'
                  ? moduleErrors.outcomes.message
                  : 'Fix outcome errors above'}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendOutcome({ id: crypto.randomUUID(), text: '', objectiveIds: [] })
              }
            >
              + Add outcome
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Check TypeScript**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | grep -i "error" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/wizard/StepStructure.tsx apps/web/src/components/wizard/ModuleItem.tsx
git commit -m "feat: wire SuggestedInput into StepStructure and ModuleItem"
```

---

## Task 6: Run all backend tests

**Files:** none

- [ ] **Step 1: Run the full API test suite**

```bash
cd apps/api && pnpm vitest run 2>&1 | tail -20
```

Expected: all tests pass (including the new `wizard.test.ts` and all pre-existing tests).

---

## Verification (manual)

- [ ] Start dev servers: `pnpm dev` from repo root
- [ ] Open `/teacher/courses/new`, click into **Course name** — after 2s with no typing, gray ghost text appears in the placeholder
- [ ] Press **Tab** — field fills with the suggestion; "Tab to accept" hint disappears
- [ ] Type something then clear it — ghost text reappears after 2s of being empty and focused
- [ ] Type before 2s fires — no suggestion appears
- [ ] Blur the field before 2s — no network request is made (check DevTools Network tab)
- [ ] Re-focus an empty field — timer restarts cleanly, suggestion appears after 2s
- [ ] Advance to Step 2, add a module, focus module name — suggestion uses course name/subject/audience
- [ ] Focus an objective field — suggestion references the module name
- [ ] Focus an outcome field — suggestion references module name and any filled objectives
- [ ] Language `<Select>` and the read-only Steps 3-4 are unchanged
