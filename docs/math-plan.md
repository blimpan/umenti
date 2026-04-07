**Migration Plan**
1. **Phase 0: Lock the Math Contract**
- Define canonical syntax: inline `$...$`, block `$$...$$`, currency as `\$`.
- Add this contract to prompts in [`courseGeneration.ts`](/Users/linus/Coding/metis/apps/api/src/services/courseGeneration.ts).
- Document allowed macros and forbidden patterns in `docs/` (new short spec).

2. **Phase 1: Rendering Upgrade**
- Add `remark-math`, `rehype-katex`, `katex` in web app.
- Update markdown renderers in [`SessionShell.tsx`](/Users/linus/Coding/metis/apps/web/src/app/student/courses/[id]/module/[moduleId]/session/SessionShell.tsx) to use those plugins.
- Replace plain-text exercise question/option rendering with markdown rendering in:
  - [`MultipleChoiceExercise.tsx`](/Users/linus/Coding/metis/apps/web/src/app/student/courses/[id]/module/[moduleId]/session/MultipleChoiceExercise.tsx)
  - [`FreeTextExercise.tsx`](/Users/linus/Coding/metis/apps/web/src/app/student/courses/[id]/module/[moduleId]/session/FreeTextExercise.tsx)
- Add regression fixtures for typical math/currency edge cases.

3. **Phase 2: Generation Hardening**
- Update pass-2/pass-3 prompts to explicitly require valid LaTeX delimiters and escaped currency.
- Add server-side validation checks before persisting generated content:
  - delimiter balance
  - no disallowed macros
  - no malformed block/inline mixing
- On validation failure, retry generation once with a corrective prompt that includes the original output and the specific validation error (e.g. "the following block delimiter was never closed: $$").

4. **Phase 3: Student Math Input**
- Introduce math input component (MathLive) for math-capable exercises, keep textarea fallback for non-math.
- Store both raw input and MathLive's normalized LaTeX output. SymPy-based canonical normalization is added in Phase 4 — this phase only ensures the input is well-formed LaTeX.
- Add UI affordances: preview, keyboard shortcuts, basic syntax hints.

5. **Phase 4: Deterministic Validation Service**
- Add a standalone Python FastAPI microservice that wraps SymPy behind a narrow HTTP API:
  - `POST /check-equivalence` — returns `{ equivalent: bool, error?: string }`
  - `POST /evaluate-at-points` — numerical fallback for unsupported symbolic cases
  - `POST /solve` — compare solution sets where needed
- Express calls the microservice over HTTP; it is not a subprocess — it runs independently and is deployed/scaled separately from the Node.js server.
- Requires a schema migration: exercise table needs a `canonicalAnswer` field to store the SymPy-normalized form of the correct answer at generation time.
- SymPy handles two moments in the pipeline:
  - **Generation time**: compute and validate the correct answer symbolically before persisting.
  - **Submission time**: check if the student's expression is equivalent to the stored correct answer.
- Sandbox execution with strict timeout, memory limits, whitelist of operations.
- Keep LLM feedback narrative, but correctness comes from deterministic checks.

6. **Phase 5: Gradual Rollout + Backfill**
- Feature flags by course/module.
- Backfill old exercises with syntax normalization and preview audit.
- Telemetry: parse failure rate, validation disagreement rate, student input error rate.

**Acceptance Criteria**
1. All student-facing math content renders correctly in theory, AI messages, and exercises.
2. Student can enter formatted math and preview what will be graded.
3. Math correctness is validated deterministically (not LLM-only) for supported question types.
4. No regressions for non-math courses.