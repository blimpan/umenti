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
