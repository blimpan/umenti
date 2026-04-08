// apps/api/src/lib/sympyClient.ts
import { logger } from './logger'

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
      const error = (body.detail as string) ?? `HTTP ${res.status}`
      logger.warn({ latex, error }, '[sympy] normalize failed')
      return { error }
    }
    const result = await res.json() as { sympyExpr: string }
    logger.info({ latex, sympyExpr: result.sympyExpr }, '[sympy] normalize')
    return result
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err)
    logger.error({ latex, error }, '[sympy] normalize unreachable')
    return { error }
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
    if (!res.ok) {
      logger.warn({ exprA, exprB, status: res.status }, '[sympy] check-equivalence failed')
      return { equivalent: false, error: `HTTP ${res.status}` }
    }
    const result = await res.json() as EquivalenceResult
    logger.info({ exprA, exprB, equivalent: result.equivalent, error: result.error }, '[sympy] check-equivalence')
    return result
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err)
    logger.error({ exprA, exprB, error }, '[sympy] check-equivalence unreachable')
    return { equivalent: false, error }
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
    if (!res.ok) {
      logger.warn({ exprA, exprB, status: res.status }, '[sympy] evaluate-at-points failed')
      return { equivalent: false, error: `HTTP ${res.status}` }
    }
    const result = await res.json() as EquivalenceResult
    logger.info({ exprA, exprB, equivalent: result.equivalent, error: result.error }, '[sympy] evaluate-at-points')
    return result
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err)
    logger.error({ exprA, exprB, error }, '[sympy] evaluate-at-points unreachable')
    return { equivalent: false, error }
  }
}
