# Visualization Template Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unreliable LLM-generated HTML visualizations with a library of pre-built, tested React components; add concept type classification to make visualization decisions principled.

**Architecture:** Pass 2 classifies each concept into a type and outputs a `visualizations[]` array (parallel to `theoryBlocks[]`), stored as `ConceptVisualization` rows. Pass 3 picks `templateId + initialParams + targetState` independently for interactive exercises. The frontend `VisualizationRenderer` routes `templateId` → a React component via a registry. Custom HTML (legacy and escape hatch) continues to render via `VisualizationFrame` in an iframe.

**Tech Stack:** React 19, Recharts (already installed), custom SVG, Prisma, Zod, Vitest.

---

## File Map

**New files:**
- `apps/web/src/components/visualizations/VisualizationRenderer.tsx`
- `apps/web/src/components/visualizations/shared/types.ts`
- `apps/web/src/components/visualizations/shared/Slider.tsx`
- `apps/web/src/components/visualizations/templates/CartesianGraph.tsx`
- `apps/web/src/components/visualizations/templates/UnitCircle.tsx`
- `apps/web/src/components/visualizations/templates/ProbabilityDistribution.tsx`
- `apps/web/src/components/visualizations/templates/GeometricShapeExplorer.tsx`
- `apps/api/src/lib/vizGrading.test.ts`
- `apps/api/prisma/migrations/<timestamp>_add_concept_visualization/`

**Modified files:**
- `apps/api/prisma/schema.prisma` — new `ConceptVisualization` model; `conceptType` on `Concept`; viz fields on `Exercise`
- `packages/types/src/index.ts` — `ConceptVisualization` type; updated `CourseConcept`, `CourseExercise`, `ChatMessage`, `SseEvent`
- `apps/api/src/lib/vizGrading.ts` — add `GradingResult` + `gradeVizState`
- `apps/api/src/services/courseGeneration.ts` — updated schemas + prompts + DB write functions
- `apps/api/src/routes/student.ts` — include `visualizations` in concept query; add viz fields to exercise mapping
- `apps/api/src/routes/session.ts` — update theory block payload; use `gradeVizState` for INTERACTIVE
- `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx` — `TheoryBlock` uses `VisualizationRenderer`
- `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/InteractiveExercise.tsx` — uses `VisualizationRenderer`

---

## Task 1: Prisma Schema + Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Add new model and fields to schema**

In `schema.prisma`, add after the `TheoryBlock` model:

```prisma
model ConceptVisualization {
  id                  Int     @id @default(autoincrement())
  concept             Concept @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  conceptId           Int
  order               Int
  visualizationType   String
  visualizationParams Json
  visualization       String? // custom HTML fallback when templateId = 'custom'

  @@index([conceptId])
}
```

On the `Concept` model, add two fields (keep `visualization String?` unchanged):
```prisma
conceptType    String?
visualizations ConceptVisualization[]
```

On the `Exercise` model, add two fields (keep `visualizationHtml String?` and `targetState Json?` unchanged):
```prisma
visualizationType   String?
visualizationParams Json?
```

- [ ] **Step 2: Run migration**

```bash
cd apps/api && pnpm prisma migrate dev --name add_concept_visualization_and_type
```

Expected: migration file created, Prisma client regenerated.

- [ ] **Step 3: Verify schema compiles**

```bash
cd apps/api && pnpm prisma validate
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat: add ConceptVisualization model and conceptType/viz fields"
```

---

## Task 2: Shared Types

**Files:**
- Modify: `packages/types/src/index.ts`

- [ ] **Step 1: Add `ConceptVisualization` type and update `CourseConcept`**

Replace the `CourseConcept` type (currently lines 86–92) with:

```typescript
export type ConceptVisualization = {
  id: number
  order: number
  visualizationType: string            // templateId e.g. "cartesian_graph"
  visualizationParams: Record<string, unknown>
  visualization?: string | null        // custom HTML fallback
}

export type CourseConcept = {
  id: number
  name: string
  order: number
  conceptType?: string | null
  theoryBlocks: CourseTheoryBlock[]
  visualization?: string               // legacy custom HTML — kept for old courses
  visualizations: ConceptVisualization[]
}
```

- [ ] **Step 2: Update `CourseExercise` to add template viz fields**

Add two fields to `CourseExercise` after `visualizationHtml`:

```typescript
export type CourseExercise = {
  id: number
  type: 'MULTIPLE_CHOICE' | 'FREE_TEXT' | 'INTERACTIVE'
  question: string
  order: number
  pendingRevision: boolean
  conceptIds: number[]
  options: string[] | null
  correctIndex: number | null
  explanation: string | null
  sampleAnswer: string | null
  rubric: string | null
  visualizationHtml: string | null
  visualizationType: string | null            // new
  visualizationParams: Record<string, unknown> | null  // new
}
```

`StudentExercise = Omit<CourseExercise, 'correctIndex' | 'sampleAnswer' | 'rubric'>` — the new fields flow through automatically.

- [ ] **Step 3: Update `ChatMessage` and `SseEvent` theory block payloads**

Replace the `THEORY_BLOCK` line in `ChatMessage` (currently line 230):
```typescript
| { type: 'THEORY_BLOCK'; payload: { conceptId: number; blocks: string[]; visualizations: ConceptVisualization[]; visualization?: string } }
```

Replace the `system:theory_block` line in `SseEvent` (currently line 240):
```typescript
| { type: 'system:theory_block'; payload: { conceptId: number; blocks: string[]; visualizations: ConceptVisualization[]; visualization?: string } }
```

- [ ] **Step 4: Build to verify no type errors**

```bash
cd packages/types && pnpm build
```

Expected: compiled without errors.

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat: add ConceptVisualization type and template viz fields to shared types"
```

---

## Task 3: Extend vizGrading + Tests

**Files:**
- Modify: `apps/api/src/lib/vizGrading.ts`
- Create: `apps/api/src/lib/vizGrading.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/lib/vizGrading.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { compareVizStates, gradeVizState } from './vizGrading'

describe('gradeVizState', () => {
  it('returns correct when all numeric values exactly match', () => {
    expect(gradeVizState({ slope: 2, intercept: -3 }, { slope: 2, intercept: -3 })).toBe('correct')
  })

  it('returns correct when values are within epsilon', () => {
    // |2.04 - 2| = 0.04 ≤ 0.05
    expect(gradeVizState({ slope: 2 }, { slope: 2.04 })).toBe('correct')
  })

  it('returns almost when values are within 2× epsilon but outside epsilon', () => {
    // |2.08 - 2| = 0.08 > 0.05 but ≤ 0.10
    expect(gradeVizState({ slope: 2 }, { slope: 2.08 })).toBe('almost')
  })

  it('returns incorrect when any value exceeds 2× epsilon', () => {
    // |2.15 - 2| = 0.15 > 0.10
    expect(gradeVizState({ slope: 2 }, { slope: 2.15 })).toBe('incorrect')
  })

  it('handles zero target value without crashing', () => {
    // range = 1 (not 0); 0.04 ≤ 0.05 → correct
    expect(gradeVizState({ intercept: 0 }, { intercept: 0.04 })).toBe('correct')
  })

  it('respects per-key _tolerance overrides', () => {
    const target = { angle: 45, _tolerance: { angle: 2 } }
    expect(gradeVizState(target, { angle: 46.5 })).toBe('correct')   // within 2
    expect(gradeVizState(target, { angle: 48.5 })).toBe('almost')    // within 4
    expect(gradeVizState(target, { angle: 50 })).toBe('incorrect')   // outside 4
  })

  it('returns incorrect when a numeric key is missing from submitted', () => {
    expect(gradeVizState({ slope: 2, intercept: -3 }, { slope: 2 })).toBe('incorrect')
  })

  it('matches non-numeric values exactly', () => {
    expect(gradeVizState({ mode: 'linear' }, { mode: 'linear' })).toBe('correct')
    expect(gradeVizState({ mode: 'linear' }, { mode: 'quadratic' })).toBe('incorrect')
  })

  it('skips metadata keys starting with underscore', () => {
    expect(gradeVizState({ slope: 2, _meta: 'info' }, { slope: 2 })).toBe('correct')
  })
})

describe('compareVizStates (unchanged)', () => {
  it('returns true when within epsilon', () => {
    expect(compareVizStates({ slope: 2 }, { slope: 2.04 })).toBe(true)
  })

  it('returns false when outside epsilon', () => {
    expect(compareVizStates({ slope: 2 }, { slope: 2.08 })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm vitest run src/lib/vizGrading.test.ts
```

Expected: FAIL — `gradeVizState is not exported`.

- [ ] **Step 3: Add `GradingResult` type and `gradeVizState` to vizGrading.ts**

Add to `apps/api/src/lib/vizGrading.ts` after the existing code:

```typescript
export type GradingResult = 'correct' | 'almost' | 'incorrect'

/**
 * Three-tier grading for interactive visualization exercises.
 * - 'correct':   all values within epsilon (or exact for non-numeric)
 * - 'almost':    all values within 2 × epsilon
 * - 'incorrect': at least one value outside 2 × epsilon
 */
export function gradeVizState(
  target: Record<string, unknown>,
  actual: Record<string, unknown>,
  epsilon = DEFAULT_EPSILON,
): GradingResult {
  const toleranceOverrides = (target._tolerance ?? {}) as Record<string, number>
  let withinStrict = true
  let withinLoose  = true

  for (const [key, expected] of Object.entries(target)) {
    if (key.startsWith('_')) continue

    const actualVal = actual[key]

    if (typeof expected === 'number') {
      const tol = typeof toleranceOverrides[key] === 'number' ? toleranceOverrides[key] : epsilon
      if (typeof actualVal !== 'number') { withinStrict = false; withinLoose = false; continue }
      const diff = Math.abs(actualVal - expected)
      if (diff > tol)      withinStrict = false
      if (diff > tol * 2)  withinLoose  = false
    } else {
      if (actualVal !== expected) { withinStrict = false; withinLoose = false }
    }
  }

  if (withinStrict) return 'correct'
  if (withinLoose)  return 'almost'
  return 'incorrect'
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/api && pnpm vitest run src/lib/vizGrading.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/vizGrading.ts apps/api/src/lib/vizGrading.test.ts
git commit -m "feat: add gradeVizState with three-tier correct/almost/incorrect grading"
```

---

## Task 4: Shared Visualization Primitives

**Files:**
- Create: `apps/web/src/components/visualizations/shared/types.ts`
- Create: `apps/web/src/components/visualizations/shared/Slider.tsx`

- [ ] **Step 1: Create shared types**

Create `apps/web/src/components/visualizations/shared/types.ts`:

```typescript
export interface VisualizationTemplateProps<
  P,
  S extends Record<string, number | string | boolean> = Record<string, number>,
> {
  params: P
  targetState?: Partial<S>
  onStateChange?: (state: S) => void
}
```

- [ ] **Step 2: Create shared Slider component**

Create `apps/web/src/components/visualizations/shared/Slider.tsx`:

```tsx
'use client'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step, onChange }: SliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[11px] text-gray-500">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{value.toFixed(step < 0.1 ? 3 : step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 accent-indigo-500 cursor-pointer"
      />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/visualizations/
git commit -m "feat: add shared VisualizationTemplateProps and Slider primitive"
```

---

## Task 5: CartesianGraph Template

**Files:**
- Create: `apps/web/src/components/visualizations/templates/CartesianGraph.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/visualizations/templates/CartesianGraph.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { Slider } from '../shared/Slider'
import type { VisualizationTemplateProps } from '../shared/types'

export type CartesianGraphParams = {
  mode: 'linear' | 'quadratic' | 'sinusoidal'
  slope?: number; intercept?: number
  a?: number; b?: number; c?: number
  amplitude?: number; frequency?: number; phase?: number
  xMin?: number; xMax?: number
}

export type CartesianGraphState = Record<string, number>

function computeY(mode: string, x: number, s: Record<string, number>): number {
  if (mode === 'linear')    return s.slope * x + s.intercept
  if (mode === 'quadratic') return s.a * x ** 2 + s.b * x + s.c
  return s.amplitude * Math.sin(s.frequency * x + s.phase)
}

function buildData(mode: string, s: Record<string, number>, xMin: number, xMax: number) {
  return Array.from({ length: 201 }, (_, i) => {
    const x = xMin + (i / 200) * (xMax - xMin)
    return { x: parseFloat(x.toFixed(2)), y: parseFloat(computeY(mode, x, s).toFixed(4)) }
  })
}

const SLIDER_CONFIG: Record<string, { key: string; label: string; min: number; max: number; step: number }[]> = {
  linear:     [{ key: 'slope', label: 'Slope', min: -5, max: 5, step: 0.1 }, { key: 'intercept', label: 'Intercept', min: -10, max: 10, step: 0.5 }],
  quadratic:  [{ key: 'a', label: 'a', min: -3, max: 3, step: 0.1 }, { key: 'b', label: 'b', min: -5, max: 5, step: 0.5 }, { key: 'c', label: 'c', min: -10, max: 10, step: 0.5 }],
  sinusoidal: [{ key: 'amplitude', label: 'Amplitude', min: 0, max: 5, step: 0.1 }, { key: 'frequency', label: 'Frequency', min: 0.1, max: 5, step: 0.1 }, { key: 'phase', label: 'Phase', min: -3.14, max: 3.14, step: 0.05 }],
}

function initState(params: CartesianGraphParams): Record<string, number> {
  const { mode } = params
  if (mode === 'linear')    return { slope: params.slope ?? 1, intercept: params.intercept ?? 0 }
  if (mode === 'quadratic') return { a: params.a ?? 1, b: params.b ?? 0, c: params.c ?? 0 }
  return { amplitude: params.amplitude ?? 1, frequency: params.frequency ?? 1, phase: params.phase ?? 0 }
}

export default function CartesianGraph({
  params, targetState, onStateChange,
}: VisualizationTemplateProps<CartesianGraphParams, CartesianGraphState>) {
  const { mode, xMin = -10, xMax = 10 } = params
  const [state, setState] = useState<Record<string, number>>(() => initState(params))

  useEffect(() => { onStateChange?.(state) }, [state])

  const data = buildData(mode, state, xMin, xMax)
  const targetData = targetState ? buildData(mode, targetState as Record<string, number>, xMin, xMax) : null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis type="number" dataKey="x" domain={[xMin, xMax]} tickCount={5} stroke="#9ca3af" tick={{ fontSize: 10 }} />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} />
          <ReferenceLine x={0} stroke="#e5e7eb" />
          <ReferenceLine y={0} stroke="#e5e7eb" />
          <Line data={data} type="monotone" dataKey="y" stroke="#6366f1" dot={false} strokeWidth={2} isAnimationActive={false} />
          {targetData && (
            <Line data={targetData} type="monotone" dataKey="y" stroke="#6366f1" dot={false} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.4} isAnimationActive={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-col gap-2.5">
        {SLIDER_CONFIG[mode].map(s => (
          <Slider
            key={s.key}
            label={s.label}
            value={state[s.key]}
            min={s.min}
            max={s.max}
            step={s.step}
            onChange={v => setState(prev => ({ ...prev, [s.key]: v }))}
          />
        ))}
      </div>
      {targetState && (
        <p className="mt-2 text-[11px] text-indigo-500 font-medium">
          Target: {Object.entries(targetState).map(([k, v]) => `${k} = ${v}`).join(', ')}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it renders (manual)**

Import it somewhere in the frontend and confirm sliders move the line and `onStateChange` fires. (Full test coverage in Task 9.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/visualizations/templates/CartesianGraph.tsx
git commit -m "feat: add CartesianGraph visualization template"
```

---

## Task 6: UnitCircle Template

**Files:**
- Create: `apps/web/src/components/visualizations/templates/UnitCircle.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/visualizations/templates/UnitCircle.tsx`:

```tsx
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { VisualizationTemplateProps } from '../shared/types'

export type UnitCircleParams = {
  initialAngle?: number      // degrees, default 45
  unit?: 'degrees' | 'radians'
  showComponents?: boolean   // sin/cos legs, default true
  showTan?: boolean          // default false
}

export type UnitCircleState = { angle: number } // always in degrees

const CX = 150, CY = 150, R = 110

function toRad(deg: number) { return (deg * Math.PI) / 180 }
function fmt(n: number) { return n.toFixed(3) }

export default function UnitCircle({
  params, targetState, onStateChange,
}: VisualizationTemplateProps<UnitCircleParams, UnitCircleState>) {
  const { initialAngle = 45, unit = 'degrees', showComponents = true } = params
  const [angleDeg, setAngleDeg] = useState(initialAngle)
  const svgRef = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)

  useEffect(() => { onStateChange?.({ angle: angleDeg }) }, [angleDeg])

  const angleFromEvent = useCallback((e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current
    if (!svg) return 0
    const rect = svg.getBoundingClientRect()
    const scaleX = 300 / rect.width
    const scaleY = 300 / rect.height
    const mx = (e.clientX - rect.left) * scaleX - CX
    const my = -((e.clientY - rect.top) * scaleY - CY)
    return (Math.atan2(my, mx) * 180) / Math.PI
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    setAngleDeg(angleFromEvent(e))
  }, [angleFromEvent])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current) setAngleDeg(angleFromEvent(e))
  }, [angleFromEvent])

  const onMouseUp = useCallback(() => { dragging.current = false }, [])

  const rad = toRad(angleDeg)
  const px = CX + R * Math.cos(rad)
  const py = CY - R * Math.sin(rad)
  const displayAngle = unit === 'degrees' ? `${angleDeg.toFixed(1)}°` : `${rad.toFixed(3)} rad`

  const targetRad = targetState != null ? toRad(targetState.angle ?? 0) : null
  const tpx = targetRad !== null ? CX + R * Math.cos(targetRad) : 0
  const tpy = targetRad !== null ? CY - R * Math.sin(targetRad) : 0

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 select-none">
      <svg
        ref={svgRef}
        width="100%"
        viewBox="0 0 300 300"
        style={{ cursor: dragging.current ? 'grabbing' : 'default' }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseDown={onMouseDown}
      >
        <line x1={20} y1={CY} x2={280} y2={CY} stroke="#e5e7eb" strokeWidth={1} />
        <line x1={CX} y1={20} x2={CX} y2={280} stroke="#e5e7eb" strokeWidth={1} />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#d1d5db" strokeWidth={1.5} />

        {showComponents && (
          <>
            <line x1={CX} y1={CY} x2={px} y2={CY} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" />
            <line x1={px} y1={CY} x2={px} y2={py} stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 2" />
          </>
        )}

        <line x1={CX} y1={CY} x2={px} y2={py} stroke="#6366f1" strokeWidth={2} />

        {targetRad !== null && (
          <>
            <line x1={CX} y1={CY} x2={tpx} y2={tpy} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.4} />
            <circle cx={tpx} cy={tpy} r={7} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="3 2" opacity={0.4} />
          </>
        )}

        <circle cx={px} cy={py} r={8} fill="#6366f1" stroke="white" strokeWidth={2} style={{ cursor: 'grab' }} />

        {showComponents && (
          <>
            <text x={(CX + px) / 2} y={CY + 16} fontSize={9} fill="#f59e0b" textAnchor="middle">cos = {fmt(Math.cos(rad))}</text>
            <text x={px + 6} y={(CY + py) / 2 + 3} fontSize={9} fill="#10b981">sin = {fmt(Math.sin(rad))}</text>
          </>
        )}
      </svg>
      <p className="text-center text-xs text-gray-500 -mt-1">θ = {displayAngle}</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/visualizations/templates/UnitCircle.tsx
git commit -m "feat: add UnitCircle visualization template"
```

---

## Task 7: ProbabilityDistribution Template

**Files:**
- Create: `apps/web/src/components/visualizations/templates/ProbabilityDistribution.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/visualizations/templates/ProbabilityDistribution.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Slider } from '../shared/Slider'
import type { VisualizationTemplateProps } from '../shared/types'

export type ProbabilityDistributionParams = {
  distribution: 'normal' | 'binomial'
  mean?: number; stdDev?: number
  n?: number; p?: number
  showMean?: boolean
}

export type ProbabilityDistributionState = Record<string, number>

function normalPDF(x: number, mean: number, sd: number) {
  return (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mean) / sd) ** 2)
}

function binomCoeff(n: number, k: number): number {
  if (k > n || k < 0) return 0
  if (k === 0 || k === n) return 1
  let r = 1
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1)
  return r
}

function binomPMF(k: number, n: number, p: number) {
  return binomCoeff(n, k) * p ** k * (1 - p) ** (n - k)
}

function buildNormalData(mean: number, sd: number) {
  const range = Math.max(4 * sd, 1)
  return Array.from({ length: 200 }, (_, i) => {
    const x = mean - range + (i / 199) * 2 * range
    return { x: parseFloat(x.toFixed(2)), y: parseFloat(normalPDF(x, mean, sd).toFixed(5)) }
  })
}

function buildBinomData(n: number, p: number) {
  return Array.from({ length: n + 1 }, (_, k) => ({
    x: String(k),
    y: parseFloat(binomPMF(k, n, p).toFixed(5)),
  }))
}

export default function ProbabilityDistribution({
  params, targetState, onStateChange,
}: VisualizationTemplateProps<ProbabilityDistributionParams, ProbabilityDistributionState>) {
  const { distribution, showMean = true } = params
  const [mean, setMean]     = useState(params.mean ?? 0)
  const [stdDev, setStdDev] = useState(params.stdDev ?? 1)
  const [n, setN]           = useState(params.n ?? 10)
  const [p, setP]           = useState(params.p ?? 0.5)

  const state = distribution === 'normal' ? { mean, stdDev } : { n, p }
  useEffect(() => { onStateChange?.(state) }, [mean, stdDev, n, p])

  const data = distribution === 'normal' ? buildNormalData(mean, stdDev) : buildBinomData(n, p)

  const targetData = targetState
    ? distribution === 'normal'
      ? buildNormalData(targetState.mean ?? mean, targetState.stdDev ?? stdDev)
      : buildBinomData(Math.round(targetState.n ?? n), targetState.p ?? p)
    : null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <ResponsiveContainer width="100%" height={170}>
        <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="x" stroke="#9ca3af" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 9 }} />
          {showMean && distribution === 'normal' && (
            <ReferenceLine x={mean} stroke="#6366f1" strokeDasharray="3 2" opacity={0.6} />
          )}
          <Area type="monotone" dataKey="y" stroke="#f59e0b" fill="#fef3c7" strokeWidth={2} dot={false} isAnimationActive={false} />
          {targetData && (
            <Area data={targetData} type="monotone" dataKey="y" stroke="#6366f1" fill="none" strokeWidth={1.5} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
          )}
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-col gap-2.5">
        {distribution === 'normal' ? (
          <>
            <Slider label="Mean (μ)" value={mean} min={-5} max={5} step={0.1} onChange={setMean} />
            <Slider label="Std Dev (σ)" value={stdDev} min={0.1} max={5} step={0.1} onChange={setStdDev} />
          </>
        ) : (
          <>
            <Slider label="Trials (n)" value={n} min={2} max={50} step={1} onChange={v => setN(Math.round(v))} />
            <Slider label="Probability (p)" value={p} min={0.01} max={0.99} step={0.01} onChange={setP} />
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/visualizations/templates/ProbabilityDistribution.tsx
git commit -m "feat: add ProbabilityDistribution visualization template"
```

---

## Task 8: GeometricShapeExplorer Template

**Files:**
- Create: `apps/web/src/components/visualizations/templates/GeometricShapeExplorer.tsx`

- [ ] **Step 1: Create the component**

Create `apps/web/src/components/visualizations/templates/GeometricShapeExplorer.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Slider } from '../shared/Slider'
import type { VisualizationTemplateProps } from '../shared/types'

export type GeometricShapeParams = {
  shape: 'rectangle' | 'circle' | 'right_triangle'
  width?: number; height?: number
  radius?: number
  base?: number; legHeight?: number
  showArea?: boolean
  showPerimeter?: boolean
}

export type GeometricShapeState = Record<string, number>

const SVG_W = 260, SVG_H = 160, SCALE = 16

function fmt2(n: number) { return parseFloat(n.toFixed(2)) }

export default function GeometricShapeExplorer({
  params, targetState, onStateChange,
}: VisualizationTemplateProps<GeometricShapeParams, GeometricShapeState>) {
  const { shape, showArea = true, showPerimeter = true } = params
  const [width, setWidth]   = useState(params.width ?? 5)
  const [height, setHeight] = useState(params.height ?? 3)
  const [radius, setRadius] = useState(params.radius ?? 4)
  const [base, setBase]     = useState(params.base ?? 6)
  const [legH, setLegH]     = useState(params.legHeight ?? 4)

  const currentState: Record<string, number> =
    shape === 'rectangle'    ? { width: fmt2(width), height: fmt2(height) } :
    shape === 'circle'       ? { radius: fmt2(radius) } :
    /* right_triangle */       { base: fmt2(base), legHeight: fmt2(legH) }

  useEffect(() => { onStateChange?.(currentState) }, [width, height, radius, base, legH])

  // Computed labels
  let areaLabel = '', perimLabel = ''
  const cx = SVG_W / 2, cy = SVG_H / 2
  if (shape === 'rectangle') {
    areaLabel  = `A = ${fmt2(width * height)}`
    perimLabel = `P = ${fmt2(2 * (width + height))}`
  } else if (shape === 'circle') {
    areaLabel  = `A = πr² = ${fmt2(Math.PI * radius ** 2)}`
    perimLabel = `C = 2πr = ${fmt2(2 * Math.PI * radius)}`
  } else {
    const hyp = Math.sqrt(base ** 2 + legH ** 2)
    areaLabel  = `A = ½bh = ${fmt2(0.5 * base * legH)}`
    perimLabel = `P = ${fmt2(base + legH + hyp)}`
  }

  const ts = targetState as Record<string, number> | undefined

  // SVG shape (active)
  let shapeEl: React.ReactNode
  let targetEl: React.ReactNode = null

  if (shape === 'rectangle') {
    const sw = width * SCALE, sh = height * SCALE
    shapeEl = <rect x={cx - sw/2} y={cy - sh/2} width={sw} height={sh} fill="#bae6fd" stroke="#0ea5e9" strokeWidth={2} rx={1} />
    if (ts) {
      const tw = (ts.width ?? width) * SCALE, th = (ts.height ?? height) * SCALE
      targetEl = <rect x={cx - tw/2} y={cy - th/2} width={tw} height={th} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5} />
    }
  } else if (shape === 'circle') {
    const sr = Math.min(radius * SCALE, SVG_H / 2 - 8)
    shapeEl = <circle cx={cx} cy={cy} r={sr} fill="#bae6fd" stroke="#0ea5e9" strokeWidth={2} />
    if (ts) {
      const tr = Math.min((ts.radius ?? radius) * SCALE, SVG_H / 2 - 8)
      targetEl = <circle cx={cx} cy={cy} r={tr} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5} />
    }
  } else {
    const sb = base * SCALE, sh = legH * SCALE
    const pts = `${cx - sb/2},${cy + sh/2} ${cx + sb/2},${cy + sh/2} ${cx - sb/2},${cy - sh/2}`
    shapeEl = <polygon points={pts} fill="#bae6fd" stroke="#0ea5e9" strokeWidth={2} />
    if (ts) {
      const tb = (ts.base ?? base) * SCALE, th = (ts.legHeight ?? legH) * SCALE
      const tpts = `${cx - tb/2},${cy + th/2} ${cx + tb/2},${cy + th/2} ${cx - tb/2},${cy - th/2}`
      targetEl = <polygon points={tpts} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.5} />
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="mb-3">
        {targetEl}
        {shapeEl}
      </svg>
      <div className="flex flex-col gap-2.5">
        {shape === 'rectangle' && (
          <>
            <Slider label="Width" value={width} min={0.5} max={10} step={0.1} onChange={setWidth} />
            <Slider label="Height" value={height} min={0.5} max={8} step={0.1} onChange={setHeight} />
          </>
        )}
        {shape === 'circle' && (
          <Slider label="Radius" value={radius} min={0.5} max={7} step={0.1} onChange={setRadius} />
        )}
        {shape === 'right_triangle' && (
          <>
            <Slider label="Base" value={base} min={0.5} max={10} step={0.1} onChange={setBase} />
            <Slider label="Height" value={legH} min={0.5} max={8} step={0.1} onChange={setLegH} />
          </>
        )}
      </div>
      <div className="mt-2 flex gap-4 text-[11px] text-gray-500">
        {showArea && <span>{areaLabel}</span>}
        {showPerimeter && <span>{perimLabel}</span>}
      </div>
      {ts && (
        <p className="mt-1 text-[11px] text-indigo-500 font-medium">
          Target: {Object.entries(ts).map(([k, v]) => `${k} = ${v}`).join(', ')}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/visualizations/templates/GeometricShapeExplorer.tsx
git commit -m "feat: add GeometricShapeExplorer visualization template"
```

---

## Task 9: VisualizationRenderer

**Files:**
- Create: `apps/web/src/components/visualizations/VisualizationRenderer.tsx`

- [ ] **Step 1: Create the registry router**

Create `apps/web/src/components/visualizations/VisualizationRenderer.tsx`:

```tsx
'use client'

import dynamic from 'next/dynamic'
import VisualizationFrame from '@/components/VisualizationFrame'
import type { VisualizationTemplateProps } from './shared/types'

// Lazy-load templates — they import Recharts which is large
const CartesianGraph          = dynamic(() => import('./templates/CartesianGraph'))
const UnitCircle              = dynamic(() => import('./templates/UnitCircle'))
const ProbabilityDistribution = dynamic(() => import('./templates/ProbabilityDistribution'))
const GeometricShapeExplorer  = dynamic(() => import('./templates/GeometricShapeExplorer'))

// Registry: add new templates here only
const REGISTRY: Record<string, React.ComponentType<VisualizationTemplateProps<any, any>>> = {
  cartesian_graph:          CartesianGraph,
  unit_circle:              UnitCircle,
  probability_distribution: ProbabilityDistribution,
  geometric_shape_explorer: GeometricShapeExplorer,
}

interface Props {
  templateId?: string | null
  params?: Record<string, unknown> | null
  targetState?: Record<string, number> | null
  onStateChange?: (state: Record<string, unknown>) => void
  customHtml?: string | null
}

export default function VisualizationRenderer({
  templateId, params, targetState, onStateChange, customHtml,
}: Props) {
  if (templateId) {
    const Template = REGISTRY[templateId]
    if (Template) {
      return (
        <Template
          params={params ?? {}}
          targetState={targetState ?? undefined}
          onStateChange={onStateChange}
        />
      )
    }
    console.warn(`[VisualizationRenderer] Unknown templateId: "${templateId}" — falling back to custom HTML`)
  }
  if (customHtml) {
    return <VisualizationFrame html={customHtml} onStateChange={onStateChange} />
  }
  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/visualizations/VisualizationRenderer.tsx
git commit -m "feat: add VisualizationRenderer registry router"
```

---

## Task 10: courseGeneration.ts — Pass 2 Changes

**Files:**
- Modify: `apps/api/src/services/courseGeneration.ts`

- [ ] **Step 1: Update `Pass2Schema`**

Replace the existing `Pass2Schema` (around line 41–48):

```typescript
const Pass2VisualizationSchema = z.object({
  templateId:         z.string(),           // "cartesian_graph" | "unit_circle" | etc. | "custom"
  templateParamsJson: z.string(),           // JSON-encoded params; empty string for 'custom'
  visualizationHtml:  z.string().nullable(), // only populated when templateId = 'custom'
})

const Pass2Schema = z.object({
  concepts: z.array(z.object({
    name:           z.string(),
    conceptType:    z.enum(['geometric', 'algebraic', 'statistical', 'algorithmic', 'definitional', 'relational']),
    theoryBlocks:   z.array(z.string()),
    visualizations: z.array(Pass2VisualizationSchema),
    // visualizations is empty array for algorithmic, definitional, relational types
  })),
})
```

- [ ] **Step 2: Replace `VISUALIZATION_CONTRACT` with `TEMPLATE_CATALOG`**

Replace the entire `VISUALIZATION_CONTRACT` constant (lines 7–26) with:

```typescript
const TEMPLATE_CATALOG = `
CONCEPT CLASSIFICATION
Classify each concept with one of:
  geometric    — spatial relationships, shapes, angles, transformations
  algebraic    — functions with tunable parameters (slope, intercept, coefficients)
  statistical  — distributions, probability, data summaries
  algorithmic  — step-by-step procedures or processes
  definitional — vocabulary, taxonomy, pure classification
  relational   — connections between concepts, sets, hierarchies

VISUALIZATION TEMPLATES
Only geometric, algebraic, and statistical concepts may have visualizations.
Set visualizations to [] for all other types.

For eligible concepts choose one or more templates:

  cartesian_graph  (algebraic)
    mode: 'linear' | 'quadratic' | 'sinusoidal'
    params (linear):     { mode, slope, intercept }
    params (quadratic):  { mode, a, b, c }
    params (sinusoidal): { mode, amplitude, frequency, phase }
    optional: xMin, xMax

  unit_circle  (geometric)
    params: { initialAngle, unit ('degrees'|'radians'), showComponents, showTan }

  probability_distribution  (statistical)
    params (normal):   { distribution: 'normal', mean, stdDev }
    params (binomial): { distribution: 'binomial', n, p }

  geometric_shape_explorer  (geometric)
    params: { shape ('rectangle'|'circle'|'right_triangle'), width+height OR radius OR base+legHeight, showArea, showPerimeter }

Set templateId to the template name above.
Set templateParamsJson to a JSON-encoded string of the params object.
Use templateId "custom" only when no template fits AND the concept is strongly spatial or dynamic.
When templateId is "custom", set visualizationHtml to a complete self-contained HTML document.
`.trim()
```

- [ ] **Step 3: Update `buildPass2Prompt` to use `TEMPLATE_CATALOG`**

In `buildPass2Prompt`, replace the lines that reference `VISUALIZATION_CONTRACT` and `shouldVisualize` guidance:

```typescript
// Replace this block:
//   For each concept, decide whether a graphical interactive visualization...
//   ${VISUALIZATION_CONTRACT}
// With:
${TEMPLATE_CATALOG}
```

The full updated prompt ending should be:
```typescript
  return `
You are generating educational content for one module of a course.

Course: ${course.name}
Subject: ${course.subject}
Language: ${course.language}
Target audience: ${course.targetAudience}

Module: ${module.name}
Why this module: ${module.whyThisModule ?? ''}
Builds on: ${module.buildsOn ?? ''}
Leads into: ${module.leadsInto ?? ''}

Learning objectives:
${module.objectives.map(o => `- ${o.text}`).join('\n')}

Learning outcomes:
${module.outcomes.map(o => `- ${o.text}`).join('\n')}

${existingNames.length > 0
  ? `Concepts already created in earlier modules — reuse the exact name if semantically equivalent:\n${existingNames.map(n => `- ${n}`).join('\n')}`
  : ''}

Generate the key concepts for this module. For each concept include ordered theory paragraphs in clear markdown prose.

${MATH_SYNTAX_CONTRACT}

${TEMPLATE_CATALOG}

Respond in ${course.language}.`.trim()
```

- [ ] **Step 4: Update `writeModuleConcepts` to write `ConceptVisualization` rows**

Replace the `writeModuleConcepts` function:

```typescript
async function writeModuleConcepts(
  courseId:         number,
  moduleId:         number,
  output:           Pass2Output,
  existingConcepts: { id: number; name: string }[],
): Promise<void> {
  const conceptMap = await resolveConcepts(courseId, moduleId, output.concepts, existingConcepts)

  for (const gen of output.concepts) {
    const concept = conceptMap.get(gen.name)
    if (!concept) continue

    // Store conceptType on the Concept row
    await prisma.concept.update({
      where: { id: concept.id },
      data:  { conceptType: gen.conceptType },
    })

    await prisma.theoryBlock.createMany({
      data: gen.theoryBlocks.map((content, order) => ({ conceptId: concept.id, content, order })),
    })

    // Write each visualization as a ConceptVisualization row
    if (gen.visualizations.length > 0) {
      await prisma.conceptVisualization.createMany({
        data: gen.visualizations.map((viz, order) => ({
          conceptId:          concept.id,
          order,
          visualizationType:  viz.templateId,
          visualizationParams: viz.templateId !== 'custom' && viz.templateParamsJson
            ? JSON.parse(viz.templateParamsJson)
            : {},
          visualization: viz.templateId === 'custom' ? viz.visualizationHtml : null,
        })),
      })
    }
  }
}
```

- [ ] **Step 5: Update `extractStrings` in `runPass2` — no change needed**

The `extractStrings` lambda already extracts `c.theoryBlocks` only. Visualization HTML is excluded intentionally (not prose). No change needed.

- [ ] **Step 6: Update the `Pass2Output` type reference**

The type is inferred automatically from the new `Pass2Schema`. Verify it compiles:

```bash
cd apps/api && pnpm tsc --noEmit
```

Expected: no errors in `courseGeneration.ts`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/courseGeneration.ts
git commit -m "feat: update Pass 2 to classify concept types and generate ConceptVisualization rows"
```

---

## Task 11: courseGeneration.ts — Pass 3 Changes

**Files:**
- Modify: `apps/api/src/services/courseGeneration.ts`

- [ ] **Step 1: Update `Pass3Schema`**

Replace the interactive-related fields in `Pass3Schema` (currently `visualizationHtml` and `targetState`):

```typescript
const Pass3Schema = z.object({
  exercises: z.array(z.object({
    type:              z.enum(['multiple_choice', 'free_text', 'interactive']),
    conceptNames:      z.array(z.string()),
    question:          z.string(),
    // multiple_choice
    options:           z.array(z.string()).nullable(),
    correctIndex:      z.number().nullable(),
    explanation:       z.string().nullable(),
    // free_text
    sampleAnswer:      z.string().nullable(),
    rubric:            z.string().nullable(),
    // interactive — LLM picks its own template independently
    templateId:         z.string().nullable(),       // e.g. "cartesian_graph"
    templateParamsJson: z.string().nullable(),       // JSON-encoded initial params
    visualizationHtml:  z.string().nullable(),       // only when templateId = "custom"
    targetState:        z.string().nullable(),       // JSON-encoded target values
  })),
})
```

- [ ] **Step 2: Update `buildPass3Prompt`**

Replace the `INTERACTIVE EXERCISE ADDITIONAL CONTRACT` block in `buildPass3Prompt` with:

```typescript
// Replace lines 489-494 with:
- interactive: pick a templateId and templateParamsJson for the initial state, plus targetState.
  Available templates: cartesian_graph, unit_circle, probability_distribution, geometric_shape_explorer
  (same param schemas as in VISUALIZATION TEMPLATES above — exercises choose independently)
  Set targetState as a JSON-encoded string of the values the student must reach.
  Use templateId "custom" only when no template fits — then set visualizationHtml.
```

The full updated TASK section becomes:
```
TASK
Generate exercises that test the concepts above. Requirements:
- Include a mix of multiple_choice and free_text exercises
- Reference concepts using the EXACT names listed above (conceptNames field)
- Each exercise must link to at least one concept
- multiple_choice: provide exactly 4 options; correctIndex must be 0, 1, 2, or 3
- free_text: provide a sampleAnswer and a rubric describing what a good answer looks like
- Exercises must test understanding appropriate for: ${course.targetAudience}
- You may generate interactive exercises (type: "interactive") where the student manipulates a visualization to reach a target state. Use this for concepts where hands-on manipulation adds value beyond text answers.
- interactive: pick templateId + templateParamsJson (initial state) + targetState (JSON-encoded target). Available templates: cartesian_graph, unit_circle, probability_distribution, geometric_shape_explorer. You choose the template independently — it does not need to match any theory block visualization.

${MATH_SYNTAX_CONTRACT}

Respond in ${course.language}.
```

- [ ] **Step 3: Update `writeModuleExercises` to write template viz fields**

In `writeModuleExercises`, update the `prisma.exercise.create` call:

```typescript
const exercise = await prisma.exercise.create({
  data: {
    courseModuleId:     moduleId,
    type:               exerciseType,
    question:           ex.question,
    order:              exerciseOrder++,
    options,
    correctIndex,
    explanation:        ex.explanation,
    sampleAnswer:       ex.sampleAnswer,
    rubric:             ex.rubric,
    visualizationHtml:  ex.visualizationHtml ?? null,
    visualizationType:  ex.templateId ?? null,
    visualizationParams: ex.templateId && ex.templateId !== 'custom' && ex.templateParamsJson
      ? JSON.parse(ex.templateParamsJson)
      : undefined,
    targetState: ex.targetState ? JSON.parse(ex.targetState) : undefined,
  },
})
```

- [ ] **Step 4: Verify compilation**

```bash
cd apps/api && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/courseGeneration.ts
git commit -m "feat: update Pass 3 to output templateId/params for interactive exercises"
```

---

## Task 12: student.ts — Module Query

**Files:**
- Modify: `apps/api/src/routes/student.ts`

- [ ] **Step 1: Add `visualizations` include to the concept query**

In the `GET /api/student/courses/:courseId/modules/:moduleId` handler, update the `rawModule` query (around line 194). Find the `concept` include block:

```typescript
// current:
concept: {
  include: { theoryBlocks: { orderBy: { order: 'asc' } } },
},

// replace with:
concept: {
  include: {
    theoryBlocks:  { orderBy: { order: 'asc' } },
    visualizations: { orderBy: { order: 'asc' } },
  },
},
```

- [ ] **Step 2: Update concept mapping to include `visualizations` and `conceptType`**

Replace the concept mapping (lines 228–239):

```typescript
concepts: rawModule.conceptLinks.map(cl => ({
  id:           cl.conceptId,
  name:         cl.concept.name,
  order:        cl.order,
  conceptType:  cl.concept.conceptType ?? undefined,
  theoryBlocks: cl.concept.theoryBlocks.map(tb => ({
    id: tb.id, order: tb.order, pendingRevision: tb.pendingRevision, content: tb.content,
  })),
  visualization:  cl.concept.visualization ?? undefined,   // legacy fallback — kept
  visualizations: cl.concept.visualizations.map(v => ({
    id:                  v.id,
    order:               v.order,
    visualizationType:   v.visualizationType,
    visualizationParams: v.visualizationParams as Record<string, unknown>,
    visualization:       v.visualization ?? undefined,
  })),
})),
```

- [ ] **Step 3: Update exercise mapping to include template viz fields**

Replace the exercise mapping (lines 241–251):

```typescript
exercises: rawModule.exercises.map(ex => ({
  id:                  ex.id,
  order:               ex.order,
  pendingRevision:     ex.pendingRevision,
  type:                ex.type,
  question:            ex.question,
  conceptIds:          ex.conceptLinks.map(cl => cl.conceptId),
  options:             ex.options as string[] | null,
  explanation:         ex.explanation,
  visualizationHtml:   ex.visualizationHtml ?? null,
  visualizationType:   ex.visualizationType ?? null,
  visualizationParams: ex.visualizationParams as Record<string, unknown> | null ?? null,
})),
```

- [ ] **Step 4: Verify compilation**

```bash
cd apps/api && pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/student.ts
git commit -m "feat: include ConceptVisualization rows and template viz fields in module query"
```

---

## Task 13: session.ts — Advance Endpoint Updates

**Files:**
- Modify: `apps/api/src/routes/session.ts`

- [ ] **Step 1: Add `visualizations` to the concept include in the advance query**

In the `POST /advance` handler, find the `prisma.moduleConcept.findMany` call (around line 261). Add `visualizations` to the concept include:

```typescript
concept: {
  include: {
    theoryBlocks:    { orderBy: { order: 'asc' } },
    visualizations:  { orderBy: { order: 'asc' } },   // add this
    exerciseLinks:   { include: { exercise: { include: { conceptLinks: true } } } },
    progressEntries: { where: { userId: req.user!.id } },
  }
},
```

Do the same for the second `prisma.moduleConcept.findMany` in the submit handler (around line 522).

- [ ] **Step 2: Update theory block payload (two places in advance handler)**

**First occurrence** (Phase 2 advance, around line 317–327). Replace the `viz` variable and payload:

```typescript
if (needsTheory) {
  const blocks = needsTheory.concept.theoryBlocks.map(tb => tb.content)
  const visualizations = needsTheory.concept.visualizations.map(v => ({
    id: v.id, order: v.order,
    visualizationType: v.visualizationType,
    visualizationParams: v.visualizationParams as Record<string, unknown>,
    visualization: v.visualization ?? undefined,
  }))
  const visualization = visualizations.length === 0 ? (needsTheory.concept.visualization ?? undefined) : undefined

  await prisma.chatMessage.create({
    data: {
      sessionId: session.id, role: 'SYSTEM', type: 'THEORY_BLOCK',
      payload: { conceptId: needsTheory.conceptId, blocks, visualizations, visualization },
      order: orderCounter++,
    },
  })
  sseEmit(res, { type: 'system:theory_block', payload: { conceptId: needsTheory.conceptId, blocks, visualizations, visualization } })
}
```

**Second occurrence** (Phase 2 post-submit re-entry, around line 596–606). Apply the same pattern:

```typescript
const blocks = cl.concept.theoryBlocks.map(tb => tb.content)
const visualizations = cl.concept.visualizations.map(v => ({
  id: v.id, order: v.order,
  visualizationType: v.visualizationType,
  visualizationParams: v.visualizationParams as Record<string, unknown>,
  visualization: v.visualization ?? undefined,
}))
const visualization = visualizations.length === 0 ? (cl.concept.visualization ?? undefined) : undefined
pendingEvents.push({
  sseType: 'system:theory_block',
  msgType: 'THEORY_BLOCK',
  payload: { conceptId: cl.conceptId, blocks, visualizations, visualization },
})
```

- [ ] **Step 3: Update `toStudentExercise` to include template viz fields**

Replace the `toStudentExercise` function (lines 38–60):

```typescript
function toStudentExercise(ex: {
  id: number; type: any; question: string; order: number; pendingRevision: boolean
  options: any; explanation: string | null; visualizationHtml: string | null
  visualizationType: string | null; visualizationParams: unknown
  conceptLinks: { conceptId: number }[]
}): StudentExercise {
  return {
    id: ex.id, type: ex.type, question: ex.question, order: ex.order,
    pendingRevision: ex.pendingRevision,
    conceptIds: ex.conceptLinks.map(cl => cl.conceptId),
    options: ex.options as string[] | null,
    explanation: ex.explanation,
    visualizationHtml:   ex.visualizationHtml,
    visualizationType:   ex.visualizationType,
    visualizationParams: ex.visualizationParams as Record<string, unknown> | null,
  }
}
```

Also update the `prisma.exercise.findMany` in the advance handler to select `visualizationType` and `visualizationParams`:

```typescript
prisma.exercise.findMany({
  where: { courseModuleId: moduleId },
  include: { conceptLinks: true },
  orderBy: { order: 'asc' },
})
```

The fields are already returned by default — no change needed if `include` fetches all columns.

- [ ] **Step 4: Verify compilation**

```bash
cd apps/api && pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/session.ts
git commit -m "feat: update session advance to emit visualizations array in theory block payload"
```

---

## Task 14: session.ts — INTERACTIVE Grading with gradeVizState

**Files:**
- Modify: `apps/api/src/routes/session.ts`

- [ ] **Step 1: Update the import**

At the top of `session.ts`, update the import from `vizGrading`:

```typescript
import { compareVizStates, gradeVizState } from '../lib/vizGrading'
```

- [ ] **Step 2: Update INTERACTIVE grading to use `gradeVizState`**

Replace the INTERACTIVE grading block (currently lines 424–433):

```typescript
} else if (exercise.type === 'INTERACTIVE') {
  const { vizState } = req.body as { vizState?: Record<string, unknown> }
  if (!vizState || typeof vizState !== 'object' || Array.isArray(vizState)) {
    res.status(400).json({ error: 'vizState required for INTERACTIVE exercises' }); return
  }
  const target = exercise.targetState as Record<string, unknown> | null
  if (!target) {
    logger.warn({ exerciseId: exercise.id }, 'INTERACTIVE exercise has no targetState — marking incorrect')
    correct = false
  } else {
    const grade = gradeVizState(target, vizState)
    correct = grade === 'correct'
    // Store the grading object so the almost flag flows to the response below
    savedGrading = {
      correct,
      almost: grade === 'almost',
      scoreChange: grade === 'correct' ? 20 : grade === 'almost' ? 0 : -10,
    }
  }
}
```

- [ ] **Step 3: Update scoreChange calculation to use savedGrading for INTERACTIVE**

Replace the `scoreChange` and `feedback` calculation block (around lines 455–467):

```typescript
let scoreChange: number
let feedback: string
if (isPhase1) {
  scoreChange = 0
  feedback = ''
} else if (exercise.type === 'MULTIPLE_CHOICE') {
  scoreChange = correct ? 20 : -10
  feedback = exercise.explanation ?? ''
} else if (exercise.type === 'INTERACTIVE') {
  // savedGrading is set above for INTERACTIVE
  scoreChange = savedGrading?.scoreChange ?? (correct ? 20 : -10)
  feedback = correct
    ? 'Correct! Well done.'
    : savedGrading?.almost
    ? "You're close — try adjusting a bit further."
    : exercise.explanation ?? ''
} else {
  scoreChange = savedGrading?.scoreChange ?? 0
  feedback = 'Answer submitted.'
}
```

- [ ] **Step 4: Verify the `almost` flag flows correctly in the SSE response**

Line 473 already reads `almost: savedGrading?.almost ?? false`. Since `savedGrading` is now set for INTERACTIVE, this flows correctly. No change needed.

- [ ] **Step 5: Verify compilation**

```bash
cd apps/api && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/session.ts
git commit -m "feat: use gradeVizState for three-tier INTERACTIVE exercise grading"
```

---

## Task 15: Frontend — TheoryBlock Component

**Files:**
- Modify: `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx`

- [ ] **Step 1: Add `VisualizationRenderer` import**

At the top of `SessionShell.tsx`, add after the existing `VisualizationFrame` import:

```typescript
import VisualizationRenderer from '@/components/visualizations/VisualizationRenderer'
import type { ConceptVisualization } from '@metis/types'
```

- [ ] **Step 2: Update `TheoryBlock` component props and rendering**

Replace the `TheoryBlock` function (currently lines 76–95):

```tsx
function TheoryBlock({
  blocks,
  visualizations,
  visualization,
}: {
  blocks: string[]
  visualizations: ConceptVisualization[]
  visualization?: string   // legacy fallback
}) {
  return (
    <div
      className="rounded-xl border border-gray-300 bg-white px-5 py-4"
      style={{ boxShadow: '0 4px 0 0 #d1d5db' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Theory</p>
      {blocks.map((block, i) => (
        <div key={i} className="text-sm text-gray-700 leading-relaxed mb-2 md-content last:mb-0">
          <MathMarkdown>{block}</MathMarkdown>
        </div>
      ))}
      {visualizations.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {visualizations.map(viz => (
            <VisualizationRenderer
              key={viz.id}
              templateId={viz.visualizationType}
              params={viz.visualizationParams}
              customHtml={viz.visualization}
            />
          ))}
        </div>
      )}
      {visualizations.length === 0 && visualization && (
        <div className="mt-4">
          <VisualizationRenderer customHtml={visualization} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Update the call site to pass `visualizations`**

Find where `TheoryBlock` is rendered with a ChatMessage payload (search for `<TheoryBlock` in the file). The message type is `THEORY_BLOCK` with payload `{ conceptId, blocks, visualizations, visualization }`.

Update the render call to pass the new props:

```tsx
// Find the THEORY_BLOCK case in the message render switch/map and update to:
<TheoryBlock
  blocks={msg.payload.blocks}
  visualizations={msg.payload.visualizations ?? []}
  visualization={msg.payload.visualization}
/>
```

- [ ] **Step 4: Verify compilation**

```bash
cd apps/web && pnpm tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx
git commit -m "feat: update TheoryBlock to render ConceptVisualization array via VisualizationRenderer"
```

---

## Task 16: Frontend — InteractiveExercise

**Files:**
- Modify: `apps/web/src/app/student/courses/[id]/module/[moduleId]/session/InteractiveExercise.tsx`

- [ ] **Step 1: Replace `VisualizationFrame` with `VisualizationRenderer`**

Replace the import at the top:

```typescript
// Remove:
import VisualizationFrame from '@/components/VisualizationFrame'
// Add:
import VisualizationRenderer from '@/components/visualizations/VisualizationRenderer'
```

- [ ] **Step 2: Update the visualization render block**

Replace the visualization section (currently lines 55–62):

```tsx
{/* Template-based visualization (new) */}
{exercise.visualizationType && (
  <div className="mb-4">
    <VisualizationRenderer
      templateId={exercise.visualizationType}
      params={exercise.visualizationParams}
      onStateChange={handleStateChange}
    />
  </div>
)}
{/* Legacy iframe fallback */}
{!exercise.visualizationType && exercise.visualizationHtml && (
  <div className="mb-4">
    <VisualizationRenderer
      customHtml={exercise.visualizationHtml}
      onStateChange={handleStateChange}
    />
  </div>
)}
```

- [ ] **Step 3: Verify compilation**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/student/courses/[id]/module/[moduleId]/session/InteractiveExercise.tsx
git commit -m "feat: use VisualizationRenderer in InteractiveExercise with template and legacy fallback"
```

---

## Verification Checklist

- [ ] Generate a new math course — inspect `ConceptVisualization` table, confirm rows exist with valid `visualizationType` and `visualizationParams`
- [ ] Confirm `Concept.conceptType` is populated (e.g. `'algebraic'`)
- [ ] Find a definitional concept — confirm its `visualizations` array is empty
- [ ] Open the student session page — confirm the theory block renders a React component (not an iframe) with interactive sliders
- [ ] Confirm free-play mode: no target indicator visible, no submit button
- [ ] Open an interactive exercise — confirm the component renders with a ghost target indicator
- [ ] Submit the exercise at the correct state → result shows `correct`
- [ ] Submit slightly off → result shows `almost` with "you're close" feedback
- [ ] Confirm legacy courses (with `Concept.visualization` HTML) still render via the iframe fallback
- [ ] Run `pnpm vitest run src/lib/vizGrading.test.ts` from `apps/api` — all tests pass
