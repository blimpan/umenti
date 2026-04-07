/**
 * Wraps fetch with server-side timing logs.
 * Only useful in Server Components — logs appear in the Next.js dev server terminal.
 *
 * Usage: replace `fetch(url, opts)` with `timedFetch(url, opts)`
 */
export async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const label = url.replace(process.env.NEXT_PUBLIC_API_URL ?? '', '')
  const start = performance.now()
  const res = await fetch(url, init)
  const ms = Math.round(performance.now() - start)
  console.log(`[fetch] ${label} → ${res.status} (${ms}ms)`)
  return res
}
