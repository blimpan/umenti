# Visualization Template Library — Design Spec

**Date:** 2026-04-05
**Status:** Approved for implementation

---

## Context

Course generation currently asks the LLM to produce arbitrary self-contained HTML/JS documents for visualizations — both in theory blocks (Pass 2) and interactive exercises (Pass 3). This creates two classes of problems:

**Reliability:** The LLM must simultaneously write syntactically correct JS, load CDN libraries at the right version paths, implement the postMessage protocol, and avoid runtime errors — all in one shot with no feedback loop. A broken visualization silently renders as a blank iframe. No validation exists.

**Meaningfulness:** `shouldVisualize` is decided in the same pass as theory generation, with no principled framework. The LLM anchors to a narrow set of examples regardless of subject, and may produce technically valid but pedagogically pointless interactions.

**Goal:** Replace free-form HTML generation with a library of pre-built, tested React visualization components. The LLM picks a template and fills in typed parameter values — no HTML generation. Custom HTML remains as an escape hatch for exotic subjects.

---

## Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| Rendering approach | React components in-page | Templates are trusted code — no need for iframe sandboxing. State is React state, no postMessage overhead. |
| Chart library | Recharts (already installed) | Already in `apps/web/package.json`. Used for CartesianGraph and ProbabilityDistribution. |
| Geometric/spatial templates | Custom SVG | UnitCircle and GeometricShapeExplorer need drag handles — SVG gives full control. |
| LLM schema shape | Flat (no discriminated union) | Anthropic structured output forbids `oneOf`/`anyOf`. Same workaround already used for `targetState`. |
| Visualizations per concept | One-to-many (`ConceptVisualization` table) | Mirrors the `TheoryBlock` pattern. A concept may genuinely benefit from multiple visualizations showing different aspects. |
| Exercise visualization | Fully independent from theory block | Exercises may benefit from a different framing; concepts without theory visualizations should still support interactive exercises. |
| When to generate visualizations | Concept type classification + hard eligibility rules | The LLM classifies each concept into a type; the prompt restricts which templates are eligible per type. Definitional and algorithmic concepts cannot receive visualizations at the schema level. |
| v1 template set | 4 templates (see below) | Covers Math/Algebra, Statistics, and Geometry — the three subject areas prioritized. Number Line deferred. |

---

## V1 Template Set

| Template ID | Rendering | Subject area |
|---|---|---|
| `cartesian_graph` | Recharts + sliders | Math, Calculus, Algebra |
| `unit_circle` | Custom SVG + drag handle | Geometry, Trigonometry |
| `probability_distribution` | Recharts + sliders | Statistics, Probability |
| `geometric_shape_explorer` | Custom SVG + drag handles | Geometry |

---

## Architecture: Two Visualization Paths

### Path A — Theory block (exploratory)

Generated in **Pass 2**. Stored as `ConceptVisualization` rows (one-to-many, like `TheoryBlock`). Rendered as free-play explorers below the theory paragraphs — no target state, no grading. A concept may have zero, one, or more visualizations.

```
Pass 2 LLM output per concept
  → { conceptType: 'algebraic', visualizations: [{ templateId: 'cartesian_graph', templateParamsJson: '{"mode":"linear","slope":1}' }] }
  → ConceptVisualization rows created (order 0, 1, 2 ...)
  → fetched alongside theoryBlocks when content is loaded
  → VisualizationRenderer renders each in order below the prose paragraphs
  → student explores freely, no submission
```

**When to display:** If `concept.visualizations.length > 0`, render them. The generation-time rules guarantee the DB only contains meaningful visualizations — no runtime decision needed.

### Path B — Interactive exercise (graded)

Generated in **Pass 3**. Stored on the `Exercise` row. Fully independent from any theory block visualization. The LLM picks `templateId`, `initialParams`, and `targetState` independently.

```
Pass 3 LLM output
  → { type: 'interactive', templateId: 'cartesian_graph',
      templateParamsJson: '{"mode":"linear","slope":0,"intercept":0}',
      targetState: '{"slope":2,"intercept":-3}' }
  → stored as Exercise.visualizationType + Exercise.visualizationParams + Exercise.targetState
  → VisualizationRenderer renders <CartesianGraph params={...} targetState={...} onStateChange={setState} />
  → student adjusts sliders, submits current state
  → compareStates(targetState, submittedState) → 'correct' | 'almost' | 'incorrect'
```

**Key:** Both paths use `VisualizationRenderer`, which routes `templateId` to the correct React component. The same component handles both modes — `targetState` present = exercise mode with target indicator; absent = free play.

---

## Concept Type Classification

Pass 2 classifies every concept into one of these types before deciding on visualizations. The type drives eligibility — the LLM cannot generate a visualization for a type that has none.

| Type | Definition | Eligible templates |
|---|---|---|
| `geometric` | Spatial relationships, shapes, angles | `geometric_shape_explorer`, `unit_circle` |
| `algebraic` | Functions and their parameters | `cartesian_graph` |
| `statistical` | Distributions, probability, data | `probability_distribution` |
| `algorithmic` | Step-by-step procedures | *(none — prose is the right medium)* |
| `definitional` | Vocabulary, taxonomy, classification | *(none — no meaningful interaction)* |
| `relational` | Connections between concepts or sets | *(none in v1 — deferred to venn_diagram / force_graph)* |

The `conceptType` is stored on the `Concept` row (used for future analytics and adaptive features, not only for visualization gating).

---

## Component API

All templates implement this shared interface:

```typescript
// apps/web/src/components/visualizations/shared/types.ts
export interface VisualizationTemplateProps<P, S extends Record<string, number>> {
  params: P
  targetState?: Partial<S>           // present in exercise mode
  onStateChange?: (state: S) => void // present in exercise mode
}
```

### CartesianGraph

```typescript
type CartesianGraphParams = {
  mode: 'linear' | 'quadratic' | 'sinusoidal'
  // linear
  slope?: number       // default 1
  intercept?: number   // default 0
  // quadratic
  a?: number; b?: number; c?: number
  // sinusoidal
  amplitude?: number; frequency?: number; phase?: number
  xMin?: number        // default -10
  xMax?: number        // default 10
}

type CartesianGraphState =
  | { slope: number; intercept: number }
  | { a: number; b: number; c: number }
  | { amplitude: number; frequency: number; phase: number }
```

Slider ranges are hardcoded in the component (LLM cannot change them). Target indicator: dashed ghost line at target param values.

### UnitCircle

```typescript
type UnitCircleParams = {
  initialAngle?: number       // degrees, default 45
  unit?: 'degrees' | 'radians'
  showComponents?: boolean    // sin/cos legs, default true
  showTan?: boolean           // default false
}

type UnitCircleState = { angle: number } // always in degrees internally
```

Interaction: drag point around the circumference. Target indicator: ghost point at target angle.

### ProbabilityDistribution

```typescript
type ProbabilityDistributionParams = {
  distribution: 'normal' | 'binomial'
  mean?: number    // normal, default 0
  stdDev?: number  // normal, default 1
  n?: number       // binomial, default 10
  p?: number       // binomial, default 0.5
  showMean?: boolean // default true
}

type ProbabilityDistributionState =
  | { mean: number; stdDev: number }
  | { n: number; p: number }
```

Target indicator: ghost curve overlay at target distribution.

### GeometricShapeExplorer

```typescript
type GeometricShapeParams = {
  shape: 'rectangle' | 'circle' | 'right_triangle'
  width?: number; height?: number   // rectangle
  radius?: number                   // circle
  base?: number; legHeight?: number // right_triangle
  showArea?: boolean      // default true
  showPerimeter?: boolean // default true
}

type GeometricShapeState =
  | { width: number; height: number }
  | { radius: number }
  | { base: number; legHeight: number }
```

Interaction: SVG drag handles on edges/corners. Live readout of area and perimeter formulas. Target indicator: ghost shape outline at target dimensions.

---

## File Structure

```
apps/web/src/components/visualizations/
  VisualizationRenderer.tsx        # registry router — no rendering logic
  shared/
    types.ts                       # VisualizationTemplateProps<P, S>
    Slider.tsx                     # shared styled slider primitive
  templates/
    CartesianGraph.tsx
    UnitCircle.tsx
    ProbabilityDistribution.tsx
    GeometricShapeExplorer.tsx

apps/api/src/lib/
  vizGrading.ts                    # compareStates() — pure function, no side effects

apps/api/src/services/
  courseGeneration.ts              # modified: schema + prompt changes only

apps/api/prisma/
  schema.prisma                    # new ConceptVisualization model; conceptType on Concept; viz fields on Exercise

packages/types/src/
  index.ts                         # ConceptVisualization type; updated CourseConcept + CourseExercise
```

### VisualizationRenderer — registry pattern

```typescript
const REGISTRY: Record<string, React.ComponentType<VisualizationTemplateProps<any, any>>> = {
  cartesian_graph:          CartesianGraph,
  unit_circle:              UnitCircle,
  probability_distribution: ProbabilityDistribution,
  geometric_shape_explorer: GeometricShapeExplorer,
  // add new templates here only
}

export function VisualizationRenderer({ templateId, params, targetState, onStateChange, customHtml }) {
  if (templateId) {
    const Template = REGISTRY[templateId]
    if (Template) return <Template params={params} targetState={targetState} onStateChange={onStateChange} />
    console.warn(`[VisualizationRenderer] Unknown templateId: ${templateId}`)
  }
  if (customHtml) return <VisualizationFrame html={customHtml} onStateChange={onStateChange} />
  return null
}
```

Adding a new template: create `templates/NewTemplate.tsx`, add one line to `REGISTRY`. No other files change.

---

## Database Schema Changes

```prisma
model Concept {
  // existing fields kept unchanged
  visualization  String?      // custom HTML fallback for old courses
  conceptType    String?      // new — 'geometric' | 'algebraic' | 'statistical' | 'algorithmic' | 'definitional' | 'relational'
  visualizations ConceptVisualization[]
}

// New model — mirrors the TheoryBlock pattern
model ConceptVisualization {
  id                  Int     @id @default(autoincrement())
  concept             Concept @relation(fields: [conceptId], references: [id], onDelete: Cascade)
  conceptId           Int
  order               Int
  visualizationType   String            // templateId e.g. "cartesian_graph"
  visualizationParams Json              // typed params object
  visualization       String?           // custom HTML fallback (mode = 'custom')

  @@index([conceptId])
}

model Exercise {
  // existing fields kept unchanged
  visualizationHtml   String?   // custom HTML fallback
  targetState         Json?     // unchanged
  // new — for template-based INTERACTIVE exercises
  visualizationType   String?
  visualizationParams Json?
}
```

### JSON parsing in DB write functions

`templateParamsJson` is a JSON-encoded string in the Zod schema (same pattern as `targetState`). Parsed before writing:

```typescript
// in writeModuleConcepts:
visualizationParams: JSON.parse(viz.templateParamsJson),

// in writeModuleExercises:
visualizationParams: ex.templateParamsJson ? JSON.parse(ex.templateParamsJson) : undefined,
```

---

## LLM Schema Changes (courseGeneration.ts)

### Pass 2 — concept schema (replaces `shouldVisualize` + `visualizationHtml`)

```typescript
const Pass2ConceptSchema = z.object({
  name:         z.string(),
  conceptType:  z.enum(['geometric','algebraic','statistical','algorithmic','definitional','relational']),
  theoryBlocks: z.array(z.string()),
  // Array mirrors theoryBlocks pattern. Empty array for non-visualizable types.
  visualizations: z.array(z.object({
    templateId:         z.string(),          // must match an eligible template for conceptType
    templateParamsJson: z.string(),          // JSON-encoded params
    visualizationHtml:  z.string().nullable(), // only when templateId = 'custom'
  })),
})

const Pass2Schema = z.object({ concepts: z.array(Pass2ConceptSchema) })
```

### Pass 3 — interactive exercise (extended)

```typescript
// Added to the flat exercise schema:
visualizationType:   z.string().nullable(),    // templateId for INTERACTIVE exercises
templateParamsJson:  z.string().nullable(),    // JSON-encoded initial params
visualizationHtml:   z.string().nullable(),    // custom HTML fallback (unchanged)
targetState:         z.string().nullable(),    // JSON-encoded target (unchanged)
```

### Prompt changes — replacing `VISUALIZATION_CONTRACT`

Pass 2 prompt gains a `CONCEPT CLASSIFICATION + VISUALIZATION` section:

```
CONCEPT CLASSIFICATION
Classify each concept with one of these types:
  geometric    — spatial relationships, shapes, angles, transformations
  algebraic    — functions with tunable parameters (slope, intercept, coefficients)
  statistical  — distributions, probability, data summaries
  algorithmic  — step-by-step procedures or processes
  definitional — vocabulary, taxonomy, pure classification
  relational   — connections between concepts, sets, hierarchies

VISUALIZATION TEMPLATES
Only geometric, algebraic, and statistical concepts may have visualizations.
Set visualizations to an empty array for all other types.

For eligible concepts, choose from:

  cartesian_graph         (algebraic only)
    mode: 'linear' | 'quadratic' | 'sinusoidal'
    params (linear):     slope, intercept
    params (quadratic):  a, b, c
    params (sinusoidal): amplitude, frequency, phase
    xMin, xMax optional

  unit_circle             (geometric only)
    params: initialAngle (degrees), unit, showComponents, showTan

  probability_distribution  (statistical only)
    params: distribution ('normal'|'binomial'), mean+stdDev OR n+p

  geometric_shape_explorer  (geometric only)
    params: shape ('rectangle'|'circle'|'right_triangle'), dimensions, showArea, showPerimeter

Set templateParamsJson to a JSON-encoded object with the chosen params.
A concept may have multiple visualizations if different templates each add distinct value.
Use templateId 'custom' only when no template fits AND the concept is strongly spatial.
```

Pass 3 prompt gains a `INTERACTIVE EXERCISE TEMPLATES` section with the same catalog but no type restrictions (exercises choose their own template independently).

---

## Grading — compareStates

```typescript
// apps/api/src/lib/vizGrading.ts
export type GradingResult = 'correct' | 'almost' | 'incorrect'

export function compareStates(
  target: Record<string, unknown>,
  submitted: Record<string, unknown>,
  tolerance = 0.05
): GradingResult {
  const keys = Object.keys(target)
  let exact = 0
  let close = 0

  for (const key of keys) {
    const t = target[key]
    const s = submitted[key]
    if (typeof t === 'number' && typeof s === 'number') {
      const range = Math.abs(t) || 1  // avoid divide-by-zero when target = 0
      const diff = Math.abs(t - s) / range
      if (diff <= tolerance)          exact++
      else if (diff <= tolerance * 2) close++
    } else {
      if (t === s) exact++
    }
  }

  if (exact === keys.length)          return 'correct'
  if (exact + close === keys.length)  return 'almost'
  return 'incorrect'
}
```

- `correct`: all keys within 5% of target
- `almost`: all keys within 10% — show "you're close — try adjusting further"
- `incorrect`: one or more keys outside 10%

---

## Shared Types (packages/types)

```typescript
export type ConceptVisualization = {
  id:                 number
  order:              number
  visualizationType:  string
  visualizationParams: Record<string, unknown>
  visualization?:     string | null  // custom HTML fallback
}

export type CourseConcept = {
  id:             number
  name:           string
  order:          number
  conceptType?:   string | null
  theoryBlocks:   CourseTheoryBlock[]
  visualizations: ConceptVisualization[]   // replaces visualization?: string
}

export type CourseExercise = {
  // ... existing fields unchanged ...
  visualizationHtml:   string | null
  visualizationType:   string | null   // new
  visualizationParams: Record<string, unknown> | null  // new
  // targetState intentionally excluded — server-only
}
```

---

## Extensibility

To add a new template (e.g. `number_line`):
1. Create `apps/web/src/components/visualizations/templates/NumberLine.tsx` implementing `VisualizationTemplateProps<NumberLineParams, NumberLineState>`
2. Add `number_line: NumberLine` to `REGISTRY` in `VisualizationRenderer.tsx`
3. Add the template to the `TEMPLATE_CATALOG` prompt block in `courseGeneration.ts`, with its eligible concept types

To add a new concept type (e.g. `dynamic_system`):
1. Add to the `conceptType` enum in the Pass 2 prompt and Zod schema
2. Specify which templates are eligible in the prompt
3. No schema migration needed — `conceptType` is a plain string column

---

## Verification

1. Generate a math course — confirm `Concept.conceptType` is set (e.g. `'algebraic'`) and `ConceptVisualization` rows exist for eligible concepts
2. Generate a concept with a definitional type — confirm `visualizations` array is empty
3. Open a theory block in the student session — confirm `VisualizationRenderer` renders the React component (not an iframe) below the prose paragraphs
4. Confirm free-play mode: no target indicator, no submit button
5. Open an interactive exercise — confirm the same component renders with a visible target indicator
6. Submit at the correct state → `correct`; submit slightly off → `almost`; submit far off → `incorrect`
7. Generate a course where a concept has no matching template — confirm `templateId: 'custom'` falls back to the existing iframe renderer
8. Run unit tests for `compareStates` covering: exact match, within tolerance, just outside tolerance, zero-target edge case
