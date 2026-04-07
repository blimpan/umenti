# Deterministic Math Grading

**Date:** 2026-04-07
**Status:** Approved

## Problem

Free-text math exercises are currently graded entirely by LLM. This is unreliable: the model may "feel" an answer is correct without being able to formally verify mathematical equivalence. For example, `2·3^x` and `2*3^x` and `2 \cdot 3^{x}` are the same expression — a string comparison fails, and an LLM may disagree with itself across runs.

Additionally, student answers are heterogeneous: a student may express `D = ℝ` as a math chip, as `$\mathbb{R}$`, or as the phrase "all real numbers". All three must be handled.

The goal is to make math correctness **deterministic** — grounded in symbolic equivalence — while keeping the LLM for what it does well: understanding natural language and grading prose claims.

## Architecture

Two agents drive the system. A SymPy microservice handles all symbolic computation.

```
Exercise creation
   courseGeneration.ts
          │
          ▼
   Creation Agent (LLM structured call)
          │ extracts expected claims as LaTeX
          ▼
   SymPy Service /normalize
          │ returns canonical SymPy expressions
          ▼
   Exercise.canonicalExpressions stored in DB
          │
          │  (at submission time)
          ▼
   Grading Agent
     Step 1 — Extraction LLM
     maps student answer → {claim → LaTeX}
     handles math chips + natural language
          │
     Step 2 — SymPy /check-equivalence
     deterministic per-claim verdict
          │
     Step 3 — LLM fallback
     for claims SymPy could not evaluate
          │
          ▼
   Aggregate score + correctness verdict
```

## SymPy Microservice

A standalone Python FastAPI service. Express calls it over HTTP — it is not a subprocess. It runs independently and is deployed separately from the Node.js API.

### Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /normalize` | Converts a LaTeX expression to canonical SymPy form. Used at creation time. |
| `POST /check-equivalence` | Takes two SymPy expressions, returns `{ equivalent: bool, error?: string }`. Used at grading time. |
| `POST /evaluate-at-points` | Numerical fallback for expressions SymPy cannot resolve symbolically (e.g. some piecewise or transcendental forms). |

### Request/Response Shapes

```
POST /normalize
Body:  { latex: string }
200:   { sympyExpr: string }
422:   { error: string }  // parse failure — claim becomes LLM-only

POST /check-equivalence
Body:  { exprA: string, exprB: string }
200:   { equivalent: boolean, error?: string }

POST /evaluate-at-points
Body:  { exprA: string, exprB: string, points: number[] }
200:   { equivalent: boolean, error?: string }
```

### Safety

- Each call runs in a sandboxed subprocess with a 3-second timeout and memory limit.
- Only a whitelist of SymPy operations is permitted (no `exec`, no filesystem access, no network).
- If the service is unavailable or a call times out, the affected claim falls back to LLM grading — the service being down never blocks grading.

## Schema Change

One new field on `Exercise`:

```prisma
canonicalExpressions Json?
// Stored as: Array<{ label: string, sympyExpr: string | null }>
// sympyExpr is null for prose claims that SymPy cannot evaluate.
// null means this claim is always graded by LLM fallback.
```

No other schema changes. The existing `sampleAnswer` and `rubric` fields remain and continue to be used for LLM-graded claims and the narrative feedback prompt.

## Creation Agent

Runs inside `courseGeneration.ts` immediately after an exercise is generated. Adds one structured LLM call per exercise.

**Input:** exercise question + `sampleAnswer`

**LLM prompt (structured output):**
> Given this question and sample answer, extract the complete list of mathematical claims a student must demonstrate to answer correctly. For each claim, provide:
> - `label`: a short human-readable name (e.g. "f(x)", "domain D", "range V")
> - `latex`: the LaTeX representation of the expected value

**Then for each claim:**
1. Call `POST /normalize` with the LaTeX.
2. If normalization succeeds: store `{ label, sympyExpr }`.
3. If normalization fails (parse error): store `{ label, sympyExpr: null }` — this claim will always be LLM-graded.

**Example output for the exponential function exercise:**
```json
[
  { "label": "f(x)", "sympyExpr": "2*3**x" },
  { "label": "domain D", "sympyExpr": "Reals" },
  { "label": "range V", "sympyExpr": "Interval.open(0, oo)" }
]
```

If the creation agent fails entirely (LLM error or all claims fail normalization), the exercise falls back to the current pure-LLM grading — no exercise is left ungraded.

## Grading Agent

Replaces `gradeFreeText()` in `apps/api/src/routes/session.ts` for exercises that have `canonicalExpressions`. Exercises without it continue using the existing LLM grader.

### Step 1 — Extraction LLM call

A single structured LLM call reads the full student answer and maps it to the expected claims.

**Input:**
- The exercise question
- The list of expected claim labels
- The student's full answer text (math chips serialized as `$...$` via `richContentToText()`)

**LLM prompt (structured output):**
> The student was asked: [question]
> The expected claims are: [label list]
> The student's answer is: [full answer text]
>
> For each expected claim, extract what the student expressed:
> - If mathematical: return as `studentLatex` (normalize natural language to LaTeX where unambiguous — e.g. "all real numbers" → `\mathbb{R}`)
> - If prose: return as `studentPhrase`
> - If not addressed: return null

**Output:** `Array<{ label: string, studentLatex?: string, studentPhrase?: string }>`

This step handles all input forms:
- A math chip `$\mathbb{R}$` → `studentLatex: "\\mathbb{R}"`
- "all real numbers" → `studentLatex: "\\mathbb{R}"`
- "the domain is all positive numbers" → `studentPhrase: "the domain is all positive numbers"` (SymPy cannot verify this, falls to LLM)
- "C equals 2" → `studentLatex: "C = 2"`

### Step 2 — SymPy verification

For each claim where both `sympyExpr` (from the exercise) and `studentLatex` (from Step 1) are present:
1. Call `POST /normalize` on `studentLatex` to get a comparable SymPy form.
2. Call `POST /check-equivalence` with the exercise's `sympyExpr` and the student's normalized form.
3. If `/check-equivalence` returns an error: try `/evaluate-at-points` as a numerical fallback.
4. If both fail: that claim falls to LLM fallback.

### Step 3 — LLM fallback

For claims that reach this step (because `sympyExpr` is null, `studentLatex` was absent, or SymPy errored), grade that specific claim with a small LLM call using the existing `rubric` field and the student's `studentPhrase` (or full answer if no phrase was extracted).

### Step 4 — Score computation

- Each claim is weighted equally.
- `correct = true` if all claims pass (deterministically or via LLM fallback).
- `almost = true` if ≥ 50% of claims pass but not all.
- `scoreChange` follows the existing scale: `+20` correct, `0` almost, `-10` incorrect.
- The existing Socratic feedback LLM call (which generates the tutor's response) is unchanged — it receives the per-claim results as context.

## Fallback Hierarchy

| Condition | Behaviour |
|---|---|
| Exercise has no `canonicalExpressions` | Existing `gradeFreeText()` LLM grader — no change |
| SymPy service down / timeout | All claims fall to LLM grading for this submission |
| Claim has `sympyExpr: null` | LLM grades this claim |
| SymPy parse error on student input | LLM grades this claim |
| Extraction LLM returns null for a claim | Claim treated as not addressed → incorrect |

## Affected Files

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Add `canonicalExpressions Json?` to `Exercise` |
| `apps/api/src/services/courseGeneration.ts` | Add creation agent after exercise generation |
| `apps/api/src/routes/session.ts` | Replace `gradeFreeText()` with grading agent for exercises with `canonicalExpressions` |
| `apps/api/src/lib/sympyClient.ts` (new) | HTTP client for the SymPy microservice (normalize, check-equivalence, evaluate-at-points) |
| `sympy-service/` (new) | Python FastAPI microservice |
| `packages/types/src/index.ts` | Add `canonicalExpressions` to `CourseExercise` type |

## Out of Scope

- MULTIPLE_CHOICE exercises: already fully deterministic (index comparison), unchanged.
- INTERACTIVE exercises: graded by their own mechanism, unchanged.
- The student input UI (MathLive, RichInput): unchanged.
- Backfilling existing exercises with `canonicalExpressions`: deferred to Phase 5 per `math-plan.md`.
