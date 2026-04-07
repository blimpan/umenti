# Deterministic Math Grading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace pure-LLM grading for math exercises with a two-agent pipeline: a creation agent that stores structured canonical answers at exercise generation time, and a grading agent that extracts mathematical claims from mixed student answers (math chips + natural language) and verifies them deterministically via a SymPy microservice.

**Architecture:** A standalone Python FastAPI service (`sympy-service/`) handles all symbolic computation. At exercise creation, an LLM call extracts expected claims and SymPy normalises them to canonical form, stored in `Exercise.canonicalExpressions`. At submission, an LLM extraction step maps the student's mixed answer to those claims, then SymPy verifies each one; claims SymPy cannot evaluate fall back to an LLM grader.

**Tech Stack:** Python 3.11+, FastAPI, SymPy, sympy-antlr4 (for LaTeX parsing), pytest; Node.js/TypeScript, Vercel AI SDK (`ai`), Zod, Vitest.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `sympy-service/main.py` | Create | FastAPI endpoints: `/normalize`, `/check-equivalence`, `/evaluate-at-points` |
| `sympy-service/requirements.txt` | Create | Python dependencies |
| `sympy-service/test_main.py` | Create | Pytest tests for the three endpoints |
| `apps/api/prisma/schema.prisma` | Modify | Add `canonicalExpressions Json?` to `Exercise` |
| `packages/types/src/index.ts` | Modify | Add `CanonicalExpression` type; add field to `CourseExercise` |
| `apps/api/src/lib/sympyClient.ts` | Create | HTTP client for SymPy service (normalize, check-equivalence, evaluate-at-points) |
| `apps/api/src/lib/sympyClient.test.ts` | Create | Vitest unit tests for sympyClient (mocked fetch) |
| `apps/api/src/lib/mathCreation.ts` | Create | Creation agent: extracts canonical expressions from question + sampleAnswer |
| `apps/api/src/lib/mathGrading.ts` | Create | Grading agent: extraction LLM → SymPy verification → per-claim LLM fallback |
| `apps/api/src/lib/mathGrading.test.ts` | Create | Vitest unit tests for grading agent (mocked LLM + SymPy client) |
| `apps/api/src/services/courseGeneration.ts` | Modify | Call creation agent inside `writeModuleExercises` for FREE_TEXT exercises |
| `apps/api/src/routes/session.ts` | Modify | Route FREE_TEXT grading through `gradeMathExercise` when `canonicalExpressions` is set |

---

## Task 1: SymPy Microservice

**Files:**
- Create: `sympy-service/requirements.txt`
- Create: `sympy-service/main.py`
- Create: `sympy-service/test_main.py`

- [ ] **Step 1.1: Create requirements.txt**

```
fastapi==0.115.0
uvicorn==0.30.6
sympy==1.13.3
antlr4-python3-runtime==4.11.1
pytest==8.3.3
httpx==0.27.2
```

- [ ] **Step 1.2: Create main.py**

```python
# sympy-service/main.py
import re
import sympy
from sympy import oo, S, Interval, Symbol
from sympy.parsing.latex import parse_latex
from sympy.parsing.sympy_parser import parse_expr
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI()

# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class NormalizeRequest(BaseModel):
    latex: str

class NormalizeResponse(BaseModel):
    sympyExpr: str

class EquivalenceRequest(BaseModel):
    exprA: str
    exprB: str

class EquivalenceResponse(BaseModel):
    equivalent: bool
    error: Optional[str] = None

class EvaluateAtPointsRequest(BaseModel):
    exprA: str
    exprB: str
    points: List[float]

# ---------------------------------------------------------------------------
# LaTeX → SymPy string
# ---------------------------------------------------------------------------

# Exact-match special cases that parse_latex does not handle
_LATEX_SETS = {
    r'\mathbb{R}': 'S.Reals',
    r'\mathbb{Z}': 'S.Integers',
    r'\mathbb{N}': 'S.Naturals',
    r'\mathbb{Q}': 'S.Rationals',
    r'\emptyset':  'S.EmptySet',
    r'\varnothing': 'S.EmptySet',
}

_INFINITY_TOKENS = {r'\infty': oo, r'+\infty': oo, r'-\infty': -oo}

def _parse_bound(s: str):
    s = s.strip()
    if s in _INFINITY_TOKENS:
        return _INFINITY_TOKENS[s]
    return parse_latex(s)

def _try_parse_interval(latex: str):
    """Return a SymPy Interval if latex looks like (a,b), [a,b], (a,b], [a,b). Otherwise None."""
    m = re.fullmatch(r'([\[\(])\s*(.*?)\s*,\s*(.*?)\s*([\]\)])', latex.strip())
    if not m:
        return None
    l_paren, a_str, b_str, r_paren = m.groups()
    try:
        a = _parse_bound(a_str)
        b = _parse_bound(b_str)
        return Interval(a, b, left_open=(l_paren == '('), right_open=(r_paren == ')'))
    except Exception:
        return None

def latex_to_sympy_str(latex: str) -> str:
    """Convert a LaTeX string to a SymPy expression string suitable for storage."""
    latex = latex.strip()

    # 1. Exact special cases (sets)
    if latex in _LATEX_SETS:
        return _LATEX_SETS[latex]

    # 2. Interval notation
    interval = _try_parse_interval(latex)
    if interval is not None:
        return str(interval)

    # 3. Standard LaTeX expression
    expr = parse_latex(latex)
    return str(expr)

# ---------------------------------------------------------------------------
# SymPy string → SymPy object (safe eval)
# ---------------------------------------------------------------------------

_SAFE_LOCALS = {name: getattr(sympy, name) for name in dir(sympy) if not name.startswith('_')}
_SAFE_LOCALS['S'] = S

def _parse_sympy_str(expr_str: str):
    """Parse a stored SymPy expression string back to a SymPy object."""
    # Handle set constants written as S.Reals etc.
    if expr_str.startswith('S.'):
        attr = expr_str[2:]
        return getattr(S, attr)
    return parse_expr(expr_str, local_dict=_SAFE_LOCALS, evaluate=True)

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post('/normalize', response_model=NormalizeResponse)
def normalize(req: NormalizeRequest):
    try:
        result = latex_to_sympy_str(req.latex)
        return NormalizeResponse(sympyExpr=result)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

@app.post('/check-equivalence', response_model=EquivalenceResponse)
def check_equivalence(req: EquivalenceRequest):
    try:
        a = _parse_sympy_str(req.exprA)
        b = _parse_sympy_str(req.exprB)

        # Sets / intervals: use structural equality
        if isinstance(a, sympy.Set) and isinstance(b, sympy.Set):
            return EquivalenceResponse(equivalent=bool(a == b))

        # Expressions: difference simplifies to zero
        diff = sympy.simplify(a - b)
        return EquivalenceResponse(equivalent=bool(diff == 0))
    except Exception as exc:
        return EquivalenceResponse(equivalent=False, error=str(exc))

@app.post('/evaluate-at-points', response_model=EquivalenceResponse)
def evaluate_at_points(req: EvaluateAtPointsRequest):
    try:
        a = _parse_sympy_str(req.exprA)
        b = _parse_sympy_str(req.exprB)
        x = Symbol('x')
        for pt in req.points:
            va = complex(a.subs(x, pt))
            vb = complex(b.subs(x, pt))
            if abs(va - vb) > 1e-9:
                return EquivalenceResponse(equivalent=False)
        return EquivalenceResponse(equivalent=True)
    except Exception as exc:
        return EquivalenceResponse(equivalent=False, error=str(exc))
```

- [ ] **Step 1.3: Write failing tests**

```python
# sympy-service/test_main.py
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

class TestNormalize:
    def test_standard_expression(self):
        r = client.post('/normalize', json={'latex': r'2 \cdot 3^{x}'})
        assert r.status_code == 200
        assert 'sympyExpr' in r.json()

    def test_real_number_set(self):
        r = client.post('/normalize', json={'latex': r'\mathbb{R}'})
        assert r.status_code == 200
        assert r.json()['sympyExpr'] == 'S.Reals'

    def test_open_interval(self):
        r = client.post('/normalize', json={'latex': r'(0, \infty)'})
        assert r.status_code == 200
        assert 'Interval' in r.json()['sympyExpr']

    def test_closed_interval(self):
        r = client.post('/normalize', json={'latex': r'[0, 1]'})
        assert r.status_code == 200
        assert 'Interval' in r.json()['sympyExpr']

    def test_invalid_latex_returns_422(self):
        r = client.post('/normalize', json={'latex': r'\notacommand{'})
        assert r.status_code == 422

class TestCheckEquivalence:
    def test_identical_expressions(self):
        r = client.post('/check-equivalence', json={'exprA': '2*3**x', 'exprB': '2*3**x'})
        assert r.status_code == 200
        assert r.json()['equivalent'] is True

    def test_algebraically_equal_expressions(self):
        # x**2 + 2*x + 1 == (x + 1)**2
        r = client.post('/check-equivalence', json={
            'exprA': 'x**2 + 2*x + 1',
            'exprB': '(x + 1)**2',
        })
        assert r.status_code == 200
        assert r.json()['equivalent'] is True

    def test_unequal_expressions(self):
        r = client.post('/check-equivalence', json={'exprA': '2*x', 'exprB': '3*x'})
        assert r.status_code == 200
        assert r.json()['equivalent'] is False

    def test_equal_sets(self):
        r = client.post('/check-equivalence', json={'exprA': 'S.Reals', 'exprB': 'S.Reals'})
        assert r.status_code == 200
        assert r.json()['equivalent'] is True

class TestEvaluateAtPoints:
    def test_equal_functions_at_points(self):
        r = client.post('/evaluate-at-points', json={
            'exprA': '2*3**x',
            'exprB': '2*3**x',
            'points': [0, 1, 2],
        })
        assert r.status_code == 200
        assert r.json()['equivalent'] is True

    def test_unequal_functions_at_points(self):
        r = client.post('/evaluate-at-points', json={
            'exprA': '2*x',
            'exprB': '3*x',
            'points': [1, 2, 3],
        })
        assert r.status_code == 200
        assert r.json()['equivalent'] is False
```

- [ ] **Step 1.4: Run tests to verify they fail**

```bash
cd sympy-service && pip install -r requirements.txt && pytest test_main.py -v
```

Expected: failures because `main.py` does not exist yet. Once `main.py` is in place, re-run and all should pass.

- [ ] **Step 1.5: Run tests against completed main.py**

```bash
cd sympy-service && pytest test_main.py -v
```

Expected: all tests pass.

- [ ] **Step 1.6: Verify the service starts**

```bash
cd sympy-service && uvicorn main:app --port 8000
```

Expected: `Application startup complete.` with no errors.

- [ ] **Step 1.7: Commit**

```bash
git add sympy-service/
git commit -m "feat: add SymPy microservice for deterministic math equivalence checking"
```

---

## Task 2: Prisma Schema Migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma:246-268` (Exercise model)

- [ ] **Step 2.1: Add field to Exercise model**

In `apps/api/prisma/schema.prisma`, inside the `Exercise` model after `rubric String?` (line 258), add:

```prisma
  canonicalExpressions Json?        // Array<{ label: string, sympyExpr: string | null }>
```

The full Exercise model should now read:

```prisma
model Exercise {
  id                  Int          @id @default(autoincrement())
  courseModule        CourseModule @relation(fields: [courseModuleId], references: [id], onDelete: Cascade)
  courseModuleId      Int
  type                ExerciseType
  question            String
  order               Int
  pendingRevision     Boolean      @default(false)
  options             Json?
  correctIndex        Int?
  explanation         String?
  sampleAnswer        String?
  rubric              String?
  canonicalExpressions Json?       // Array<{ label: string, sympyExpr: string | null }>
  visualizationHtml   String?
  targetState         Json?
  visualizationType   String?
  visualizationParams Json?

  source       ExerciseSource    @default(TEACHER_PROVIDED)
  conceptLinks ExerciseConcept[]

  @@index([courseModuleId])
}
```

- [ ] **Step 2.2: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name add_canonical_expressions
```

Expected output: `The following migration(s) have been created and applied ... add_canonical_expressions`

- [ ] **Step 2.3: Verify Prisma client regenerated**

```bash
cd apps/api && npx prisma generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 2.4: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add canonicalExpressions column to Exercise"
```

---

## Task 3: Shared Types

**Files:**
- Modify: `packages/types/src/index.ts:104-122` (CourseExercise type)

- [ ] **Step 3.1: Add CanonicalExpression type and update CourseExercise**

In `packages/types/src/index.ts`, add the new type before `CourseExercise` and add the field to `CourseExercise`:

```typescript
export type CanonicalExpression = {
  label: string
  sympyExpr: string | null   // null = LLM-only claim; SymPy could not normalize
}

export type CourseExercise = {
  id: number
  type: 'MULTIPLE_CHOICE' | 'FREE_TEXT' | 'INTERACTIVE'
  question: string
  order: number
  pendingRevision: boolean
  conceptIds: number[]
  // MULTIPLE_CHOICE
  options: string[] | null
  correctIndex: number | null
  explanation: string | null
  // FREE_TEXT
  sampleAnswer: string | null
  rubric: string | null
  canonicalExpressions: CanonicalExpression[] | null  // null = not yet extracted
  // INTERACTIVE / legacy
  visualizationHtml: string | null
  visualizationType: string | null
  visualizationParams: Record<string, unknown> | null
}
```

- [ ] **Step 3.2: Verify types compile**

```bash
cd packages/types && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3.3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat: add CanonicalExpression type and canonicalExpressions field to CourseExercise"
```

---

## Task 4: SymPy HTTP Client

**Files:**
- Create: `apps/api/src/lib/sympyClient.ts`
- Create: `apps/api/src/lib/sympyClient.test.ts`

- [ ] **Step 4.1: Write failing tests first**

```typescript
// apps/api/src/lib/sympyClient.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { normalizeLatex, checkEquivalence, evaluateAtPoints } from './sympyClient'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

afterEach(() => mockFetch.mockReset())

describe('normalizeLatex', () => {
  it('returns sympyExpr on HTTP 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sympyExpr: '2*3**x' }),
    })
    const result = await normalizeLatex('2 \\cdot 3^x')
    expect(result).toEqual({ sympyExpr: '2*3**x' })
  })

  it('returns error object on HTTP 422', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ detail: 'parse error' }),
    })
    const result = await normalizeLatex('\\notvalid{')
    expect(result).toEqual({ error: 'parse error' })
  })

  it('returns error when fetch throws (service down)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('connection refused'))
    const result = await normalizeLatex('x^2')
    expect('error' in result).toBe(true)
  })
})

describe('checkEquivalence', () => {
  it('returns equivalent=true when service responds so', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ equivalent: true }),
    })
    const result = await checkEquivalence('2*3**x', '2*3**x')
    expect(result).toEqual({ equivalent: true })
  })

  it('returns equivalent=false with error when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'))
    const result = await checkEquivalence('a', 'b')
    expect(result.equivalent).toBe(false)
    expect(result.error).toBe('timeout')
  })
})

describe('evaluateAtPoints', () => {
  it('returns equivalent=true when service responds so', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ equivalent: true }),
    })
    const result = await evaluateAtPoints('2*x', '2*x', [1, 2, 3])
    expect(result).toEqual({ equivalent: true })
  })
})
```

- [ ] **Step 4.2: Run tests to confirm they fail**

```bash
cd apps/api && pnpm test -- sympyClient
```

Expected: `Cannot find module './sympyClient'`

- [ ] **Step 4.3: Implement sympyClient.ts**

```typescript
// apps/api/src/lib/sympyClient.ts

const SYMPY_SERVICE_URL = (process.env.SYMPY_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, '')
const TIMEOUT_MS = 3_000

export type NormalizeResult  = { sympyExpr: string } | { error: string }
export type EquivalenceResult = { equivalent: boolean; error?: string }

export async function normalizeLatex(latex: string): Promise<NormalizeResult> {
  try {
    const res = await fetch(`${SYMPY_SERVICE_URL}/normalize`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ latex }),
      signal:  AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>
      return { error: (body.detail as string) ?? `HTTP ${res.status}` }
    }
    return res.json() as Promise<{ sympyExpr: string }>
  } catch (err: unknown) {
    return { error: (err instanceof Error ? err.message : String(err)) }
  }
}

export async function checkEquivalence(exprA: string, exprB: string): Promise<EquivalenceResult> {
  try {
    const res = await fetch(`${SYMPY_SERVICE_URL}/check-equivalence`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ exprA, exprB }),
      signal:  AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return { equivalent: false, error: `HTTP ${res.status}` }
    return res.json() as Promise<EquivalenceResult>
  } catch (err: unknown) {
    return { equivalent: false, error: (err instanceof Error ? err.message : String(err)) }
  }
}

export async function evaluateAtPoints(exprA: string, exprB: string, points: number[]): Promise<EquivalenceResult> {
  try {
    const res = await fetch(`${SYMPY_SERVICE_URL}/evaluate-at-points`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ exprA, exprB, points }),
      signal:  AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return { equivalent: false, error: `HTTP ${res.status}` }
    return res.json() as Promise<EquivalenceResult>
  } catch (err: unknown) {
    return { equivalent: false, error: (err instanceof Error ? err.message : String(err)) }
  }
}
```

- [ ] **Step 4.4: Run tests to confirm they pass**

```bash
cd apps/api && pnpm test -- sympyClient
```

Expected: all 6 tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add apps/api/src/lib/sympyClient.ts apps/api/src/lib/sympyClient.test.ts
git commit -m "feat: add SymPy HTTP client with normalize, check-equivalence, evaluate-at-points"
```

---

## Task 5: Creation Agent

**Files:**
- Create: `apps/api/src/lib/mathCreation.ts`
- Modify: `apps/api/src/services/courseGeneration.ts:534-586` (`writeModuleExercises`)

- [ ] **Step 5.1: Create mathCreation.ts**

```typescript
// apps/api/src/lib/mathCreation.ts
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { getModel } from './llm'
import { llmLogger } from './logger'
import { normalizeLatex } from './sympyClient'
import type { CanonicalExpression } from '@metis/types'

const ClaimsSchema = z.object({
  claims: z.array(z.object({
    label: z.string(),   // e.g. "f(x)", "domain D", "range V"
    latex: z.string(),   // LaTeX representation of the expected value
  })),
})

/**
 * Extracts the mathematical claims a student must demonstrate to answer an
 * exercise correctly, normalises each to a SymPy canonical form, and returns
 * the list ready for storage in Exercise.canonicalExpressions.
 *
 * Returns an empty array if the LLM call fails. Returns null sympyExpr for
 * claims that SymPy cannot normalise — those are always graded by LLM fallback.
 */
export async function extractCanonicalExpressions(
  question:     string,
  sampleAnswer: string,
): Promise<CanonicalExpression[]> {
  let rawClaims: Array<{ label: string; latex: string }>

  try {
    const { output } = await generateText({
      model:  getModel(),
      output: Output.object({ schema: ClaimsSchema }),
      system: [
        'You extract mathematical claims from exercise questions and sample answers.',
        'For each distinct value or expression a student must state, return a short label and its LaTeX.',
        'Only extract claims whose answer is mathematical (equations, expressions, sets, intervals).',
        'Omit prose requirements such as "explain why" or "describe the behaviour".',
      ].join(' '),
      messages: [{
        role:    'user',
        content: `Question: ${question}\n\nSample answer: ${sampleAnswer}`,
      }],
    })
    rawClaims = (output as z.infer<typeof ClaimsSchema>).claims
  } catch (err) {
    llmLogger.error({ err }, '[math-creation] LLM call failed — skipping canonicalExpressions')
    return []
  }

  if (rawClaims.length === 0) return []

  // Normalise each claim. Failures produce sympyExpr: null (LLM fallback at grading time).
  return Promise.all(
    rawClaims.map(async (claim): Promise<CanonicalExpression> => {
      const result = await normalizeLatex(claim.latex)
      return {
        label:     claim.label,
        sympyExpr: 'error' in result ? null : result.sympyExpr,
      }
    }),
  )
}
```

- [ ] **Step 5.2: Call creation agent inside writeModuleExercises**

In `apps/api/src/services/courseGeneration.ts`, add the import at the top of the file (after the existing imports):

```typescript
import { extractCanonicalExpressions } from '../lib/mathCreation'
```

Then in `writeModuleExercises`, after the `prisma.exerciseConcept.createMany` call (currently the last statement in the loop body, around line 582-585), add:

```typescript
    // Creation agent: extract and store canonical expressions for FREE_TEXT exercises.
    // Runs after the exercise row exists so a failure here never blocks persistence.
    if (exerciseType === 'FREE_TEXT' && ex.sampleAnswer) {
      const canonicalExpressions = await extractCanonicalExpressions(ex.question, ex.sampleAnswer)
      if (canonicalExpressions.length > 0) {
        await prisma.exercise.update({
          where: { id: exercise.id },
          data:  { canonicalExpressions },
        })
      }
    }
```

- [ ] **Step 5.3: Verify the API typechecks**

```bash
cd apps/api && pnpm typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 5.4: Commit**

```bash
git add apps/api/src/lib/mathCreation.ts apps/api/src/services/courseGeneration.ts
git commit -m "feat: add creation agent to extract canonical expressions after exercise generation"
```

---

## Task 6: Grading Agent

**Files:**
- Create: `apps/api/src/lib/mathGrading.ts`
- Create: `apps/api/src/lib/mathGrading.test.ts`

- [ ] **Step 6.1: Write failing tests first**

```typescript
// apps/api/src/lib/mathGrading.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gradeMathExercise } from './mathGrading'
import type { CanonicalExpression } from '@metis/types'

// Mock dependencies so tests run without LLM or SymPy service
vi.mock('./llm',    () => ({ getModel: vi.fn(() => 'mock-model') }))
vi.mock('./logger', () => ({ llmLogger: { error: vi.fn(), info: vi.fn() } }))

// ai.generateText is mocked per-test to control LLM output
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return { ...actual, generateText: vi.fn() }
})

vi.mock('./sympyClient', () => ({
  normalizeLatex:     vi.fn(),
  checkEquivalence:   vi.fn(),
  evaluateAtPoints:   vi.fn(),
}))

import { generateText } from 'ai'
import * as sympyClient from './sympyClient'

const TWO_CLAIMS: CanonicalExpression[] = [
  { label: 'f(x)', sympyExpr: '2*3**x' },
  { label: 'domain D', sympyExpr: 'S.Reals' },
]

function mockExtraction(claims: Array<{ label: string; studentLatex?: string | null; studentPhrase?: string | null }>) {
  vi.mocked(generateText).mockResolvedValueOnce({
    output: { claims },
    usage: {},
  } as any)
}

beforeEach(() => {
  vi.mocked(sympyClient.normalizeLatex).mockResolvedValue({ sympyExpr: 'mock_normalised' })
  vi.mocked(sympyClient.checkEquivalence).mockResolvedValue({ equivalent: true })
})

describe('gradeMathExercise', () => {
  it('returns correct=true, scoreChange=20 when all claims pass SymPy', async () => {
    mockExtraction([
      { label: 'f(x)',     studentLatex: '2 \\cdot 3^x', studentPhrase: null },
      { label: 'domain D', studentLatex: '\\mathbb{R}',  studentPhrase: null },
    ])

    const result = await gradeMathExercise('question', TWO_CLAIMS, 'rubric', 'student answer')

    expect(result).not.toBeNull()
    expect(result!.correct).toBe(true)
    expect(result!.scoreChange).toBe(20)
    expect(result!.claimResults.every(r => r.method === 'sympy')).toBe(true)
  })

  it('returns almost=true, scoreChange=0 when exactly half of claims pass', async () => {
    mockExtraction([
      { label: 'f(x)',     studentLatex: '2*3^x',       studentPhrase: null },
      { label: 'domain D', studentLatex: '\\mathbb{R}', studentPhrase: null },
    ])
    vi.mocked(sympyClient.checkEquivalence)
      .mockResolvedValueOnce({ equivalent: true })   // f(x) passes
      .mockResolvedValueOnce({ equivalent: false })  // domain fails

    const result = await gradeMathExercise('question', TWO_CLAIMS, 'rubric', 'student answer')

    expect(result!.almost).toBe(true)
    expect(result!.correct).toBe(false)
    expect(result!.scoreChange).toBe(0)
  })

  it('returns correct=false, scoreChange=-10 when no claims pass', async () => {
    mockExtraction([
      { label: 'f(x)',     studentLatex: 'wrong',  studentPhrase: null },
      { label: 'domain D', studentLatex: 'wrong2', studentPhrase: null },
    ])
    vi.mocked(sympyClient.checkEquivalence).mockResolvedValue({ equivalent: false })

    const result = await gradeMathExercise('question', TWO_CLAIMS, 'rubric', 'student answer')

    expect(result!.correct).toBe(false)
    expect(result!.almost).toBe(false)
    expect(result!.scoreChange).toBe(-10)
  })

  it('marks a claim as missing when student does not address it', async () => {
    mockExtraction([
      { label: 'f(x)',     studentLatex: '2*3^x', studentPhrase: null },
      { label: 'domain D', studentLatex: null,    studentPhrase: null },
    ])

    const result = await gradeMathExercise('question', TWO_CLAIMS, 'rubric', 'student answer')

    const domainResult = result!.claimResults.find(r => r.label === 'domain D')!
    expect(domainResult.method).toBe('missing')
    expect(domainResult.correct).toBe(false)
  })

  it('falls back to LLM for a claim with null sympyExpr', async () => {
    const claimsWithNullSympy: CanonicalExpression[] = [
      { label: 'explanation', sympyExpr: null },
    ]
    // Extraction returns a phrase, not LaTeX
    mockExtraction([
      { label: 'explanation', studentLatex: null, studentPhrase: 'because the base is 3' },
    ])
    // LLM fallback call returns correct=true
    vi.mocked(generateText).mockResolvedValueOnce({ output: { correct: true }, usage: {} } as any)

    const result = await gradeMathExercise('question', claimsWithNullSympy, 'rubric', 'student answer')

    expect(result!.claimResults[0].method).toBe('llm')
    expect(result!.claimResults[0].correct).toBe(true)
  })

  it('returns null when the extraction LLM call throws', async () => {
    vi.mocked(generateText).mockRejectedValueOnce(new Error('LLM unreachable'))

    const result = await gradeMathExercise('question', TWO_CLAIMS, 'rubric', 'student answer')

    expect(result).toBeNull()
  })
})
```

- [ ] **Step 6.2: Run tests to confirm they fail**

```bash
cd apps/api && pnpm test -- mathGrading
```

Expected: `Cannot find module './mathGrading'`

- [ ] **Step 6.3: Implement mathGrading.ts**

```typescript
// apps/api/src/lib/mathGrading.ts
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { getModel } from './llm'
import { llmLogger } from './logger'
import { normalizeLatex, checkEquivalence, evaluateAtPoints } from './sympyClient'
import type { CanonicalExpression } from '@metis/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClaimVerificationMethod = 'sympy' | 'llm' | 'missing'

export type ClaimResult = {
  label:   string
  correct: boolean
  method:  ClaimVerificationMethod
}

export type MathGradingResult = {
  correct:      boolean
  almost:       boolean
  scoreChange:  number
  claimResults: ClaimResult[]
}

// ---------------------------------------------------------------------------
// Zod schemas for LLM structured output
// ---------------------------------------------------------------------------

const ExtractionSchema = z.object({
  claims: z.array(z.object({
    label:         z.string(),
    studentLatex:  z.string().nullable(),   // LaTeX if student expressed it mathematically
    studentPhrase: z.string().nullable(),   // Natural-language phrase if not reducible to LaTeX
  })),
})

const LlmClaimSchema = z.object({
  correct: z.boolean(),
})

// ---------------------------------------------------------------------------
// Step 1 — Extraction LLM call
// ---------------------------------------------------------------------------

async function extractStudentClaims(
  question:    string,
  claimLabels: string[],
  studentAnswer: string,
): Promise<z.infer<typeof ExtractionSchema>['claims']> {
  const { output } = await generateText({
    model:  getModel(),
    output: Output.object({ schema: ExtractionSchema }),
    system: [
      'You extract mathematical claims from student answers.',
      'For each expected claim label, find what the student expressed.',
      'If mathematical: return as studentLatex (LaTeX).',
      'Convert unambiguous natural language to LaTeX: "all real numbers" → "\\\\mathbb{R}", "positive reals" → "(0, \\\\infty)", "x equals 3" → "x = 3".',
      'If prose only (cannot be reduced to a single expression): return as studentPhrase.',
      'If the student did not address the claim: return null for both fields.',
    ].join(' '),
    messages: [{
      role:    'user',
      content: `Question: ${question}\nExpected claims: ${claimLabels.join(', ')}\nStudent answer: ${studentAnswer}`,
    }],
  })
  return (output as z.infer<typeof ExtractionSchema>).claims
}

// ---------------------------------------------------------------------------
// Step 2 — SymPy verification for one claim
// ---------------------------------------------------------------------------

async function verifyWithSympy(
  sympyExpr:    string,
  studentLatex: string,
): Promise<{ equivalent: boolean; error?: string }> {
  const normalised = await normalizeLatex(studentLatex)
  if ('error' in normalised) return { equivalent: false, error: normalised.error }

  const primary = await checkEquivalence(sympyExpr, normalised.sympyExpr)
  if (!primary.error) return primary

  // Numerical fallback — useful when simplify() times out on transcendental expressions
  return evaluateAtPoints(sympyExpr, normalised.sympyExpr, [0.5, 1, 2, Math.PI, -1])
}

// ---------------------------------------------------------------------------
// Step 3 — Per-claim LLM fallback
// ---------------------------------------------------------------------------

async function gradeClaimWithLlm(
  label:            string,
  sympyExpr:        string | null,
  studentExpression: string,
  rubric:           string,
): Promise<boolean> {
  try {
    const { output } = await generateText({
      model:  getModel(),
      output: Output.object({ schema: LlmClaimSchema }),
      system: 'You are a math teacher grading one specific claim in a student answer. Return correct=true only if the student correctly addressed this claim.',
      messages: [{
        role:    'user',
        content: [
          `Claim: ${label}`,
          `Expected: ${sympyExpr ?? '(see rubric)'}`,
          `Rubric: ${rubric}`,
          `Student said: ${studentExpression}`,
        ].join('\n'),
      }],
    })
    return (output as z.infer<typeof LlmClaimSchema>).correct
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Grades a free-text exercise that has canonicalExpressions stored.
 * Returns null if the extraction LLM call fails (caller should fall back to gradeFreeText).
 */
export async function gradeMathExercise(
  question:             string,
  canonicalExpressions: CanonicalExpression[],
  rubric:               string,
  studentAnswer:        string,
): Promise<MathGradingResult | null> {
  const claimLabels = canonicalExpressions.map(c => c.label)

  let extractedClaims: z.infer<typeof ExtractionSchema>['claims']
  try {
    extractedClaims = await extractStudentClaims(question, claimLabels, studentAnswer)
  } catch (err) {
    llmLogger.error({ err }, '[math-grading] extraction LLM call failed')
    return null
  }

  const claimResults: ClaimResult[] = await Promise.all(
    canonicalExpressions.map(async (canonical): Promise<ClaimResult> => {
      const extracted = extractedClaims.find(c => c.label === canonical.label)

      // Student did not address this claim at all
      if (!extracted || (!extracted.studentLatex && !extracted.studentPhrase)) {
        return { label: canonical.label, correct: false, method: 'missing' }
      }

      // Attempt SymPy verification when both canonical expr and student LaTeX are available
      if (canonical.sympyExpr && extracted.studentLatex) {
        const result = await verifyWithSympy(canonical.sympyExpr, extracted.studentLatex)
        if (!result.error) {
          return { label: canonical.label, correct: result.equivalent, method: 'sympy' }
        }
        // SymPy errored — fall through to LLM
      }

      // LLM fallback: claim has null sympyExpr, student used prose, or SymPy errored
      const studentExpression = extracted.studentLatex ?? extracted.studentPhrase ?? ''
      const correct = await gradeClaimWithLlm(canonical.label, canonical.sympyExpr, studentExpression, rubric)
      return { label: canonical.label, correct, method: 'llm' }
    }),
  )

  const passCount  = claimResults.filter(r => r.correct).length
  const totalCount = claimResults.length
  const correct    = passCount === totalCount
  const almost     = !correct && passCount >= Math.ceil(totalCount / 2)
  const scoreChange = correct ? 20 : almost ? 0 : -10

  llmLogger.info({ passCount, totalCount, correct, almost, scoreChange }, '[math-grading] result')

  return { correct, almost, scoreChange, claimResults }
}
```

- [ ] **Step 6.4: Run tests to confirm they pass**

```bash
cd apps/api && pnpm test -- mathGrading
```

Expected: all 6 tests pass.

- [ ] **Step 6.5: Commit**

```bash
git add apps/api/src/lib/mathGrading.ts apps/api/src/lib/mathGrading.test.ts
git commit -m "feat: add math grading agent with SymPy verification and LLM fallback"
```

---

## Task 7: Wire Grading Agent into Session Route

**Files:**
- Modify: `apps/api/src/routes/session.ts:1-10` (imports), `:468-483` (FREE_TEXT grading block)

- [ ] **Step 7.1: Add import**

At the top of `apps/api/src/routes/session.ts`, after the existing imports, add:

```typescript
import { gradeMathExercise } from '../lib/mathGrading'
import type { CanonicalExpression } from '@metis/types'
```

- [ ] **Step 7.2: Replace FREE_TEXT grading block**

Find the `else` block starting at line ~468 that calls `gradeFreeText`:

```typescript
    } else {
      savedGrading = await gradeFreeText(
        exercise.question,
        exercise.sampleAnswer ?? '',
        exercise.rubric ?? '',
        String(answer),
      )
      if (!savedGrading) {
        sseOpen(res)
        sseEmit(res, { type: 'system:message', payload: { content: 'Grading failed — please try again.' } })
        sseEmit(res, { type: 'done' })
        res.end()
        return
      }
      correct = savedGrading.correct
    }
```

Replace it with:

```typescript
    } else {
      const canonical = exercise.canonicalExpressions as CanonicalExpression[] | null

      if (canonical && canonical.length > 0) {
        // Use deterministic math grading agent; fall back to LLM grader if it returns null
        savedGrading = await gradeMathExercise(
          exercise.question,
          canonical,
          exercise.rubric ?? '',
          String(answer),
        ) ?? await gradeFreeText(
          exercise.question,
          exercise.sampleAnswer ?? '',
          exercise.rubric ?? '',
          String(answer),
        )
      } else {
        savedGrading = await gradeFreeText(
          exercise.question,
          exercise.sampleAnswer ?? '',
          exercise.rubric ?? '',
          String(answer),
        )
      }

      if (!savedGrading) {
        sseOpen(res)
        sseEmit(res, { type: 'system:message', payload: { content: 'Grading failed — please try again.' } })
        sseEmit(res, { type: 'done' })
        res.end()
        return
      }
      correct = savedGrading.correct
    }
```

- [ ] **Step 7.3: Run typecheck**

```bash
cd apps/api && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 7.4: Run full test suite**

```bash
cd apps/api && pnpm test
```

Expected: all existing tests still pass; the new tests from Tasks 4 and 6 also pass.

- [ ] **Step 7.5: Commit**

```bash
git add apps/api/src/routes/session.ts
git commit -m "feat: route FREE_TEXT grading through math grading agent when canonicalExpressions present"
```

---

## Task 8: Environment Variable and README Note

**Files:**
- Modify: `apps/api/.env.example`

- [ ] **Step 8.1: Add SYMPY_SERVICE_URL to .env.example**

In `apps/api/.env.example`, add:

```
# SymPy microservice (deterministic math grading)
# Run: cd sympy-service && uvicorn main:app --port 8000
SYMPY_SERVICE_URL=http://localhost:8000
```

- [ ] **Step 8.2: Commit**

```bash
git add apps/api/.env.example
git commit -m "chore: document SYMPY_SERVICE_URL env var"
```

---

## Self-Review Checklist

- [x] **SymPy service** — endpoints defined with request/response shapes, tests cover normalize, equivalence, numerical fallback, and error cases.
- [x] **Schema** — `canonicalExpressions Json?` added with exact Prisma syntax and migration command.
- [x] **Shared types** — `CanonicalExpression` exported from `packages/types`; `CourseExercise` updated.
- [x] **sympyClient** — all three endpoints wrapped; all error paths (HTTP error, fetch throw, timeout) return safe values without throwing.
- [x] **Creation agent** — runs after exercise creation, only for FREE_TEXT with a sampleAnswer; failures are logged but never break the generation pipeline.
- [x] **Grading agent** — extraction → SymPy → numerical fallback → LLM fallback chain covered; null returned on extraction failure so caller can fall back to `gradeFreeText`.
- [x] **session.ts wiring** — `gradeMathExercise` takes precedence when `canonicalExpressions` is set; falls back to `gradeFreeText` if it returns null.
- [x] **Type consistency** — `CanonicalExpression` used identically in `packages/types`, `mathCreation.ts`, `mathGrading.ts`, and `session.ts`.
- [x] **No placeholders** — all steps contain complete code.
