import { createClient } from '@/lib/supabase/client'

/**
 * Authenticated fetch for client-side use only.
 *
 * Calls supabase.auth.getSession() before every request so that an expired
 * access token is refreshed automatically (the Supabase browser client uses
 * its stored refresh token to do this transparently). This prevents JWTExpired
 * errors in long-lived sessions without any retry logic.
 *
 * Do NOT use this in Server Components or Route Handlers — use timedFetch with
 * the server Supabase client there.
 */
export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ''}`,
      ...init.headers,
    },
  })
}
