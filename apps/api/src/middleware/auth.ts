import { createLocalJWKSet, jwtVerify } from 'jose'
import { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger'

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string }
    }
  }
}

// Populated once at startup by initJWKS(). All requests verify against this in-memory key set.
let verifyJWT: ReturnType<typeof createLocalJWKSet> | null = null

// Fetch the Supabase JWKS and cache it in memory. Called once on server startup.
// Retries with exponential backoff so poor connectivity at boot doesn't permanently break auth.
export async function initJWKS(retries = 5): Promise<void> {
  const url = `${process.env.SUPABASE_PROJECT_URL}/auth/v1/.well-known/jwks.json`

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const jwks = await res.json()
      verifyJWT = createLocalJWKSet(jwks)
      logger.info('[auth] JWKS loaded')
      return
    } catch (err) {
      logger.warn({ err, attempt, retries }, '[auth] JWKS fetch failed')
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt))
      }
    }
  }

  throw new Error('[auth] Could not load JWKS after all retries — check your internet connection and SUPABASE_PROJECT_URL')
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearerToken = req.headers.authorization?.split(' ')[1]
  if (!bearerToken) {
    return res.status(401).json({ error: 'Missing Authorization header' })
  }

  if (!verifyJWT) {
    return res.status(503).json({ error: 'Auth service not ready' })
  }

  try {
    // Verify locally against the cached public key — no network call.
    // Tokens are short-lived (1hr), so a logged-out token remains valid at most until expiry.
    const { payload } = await jwtVerify(bearerToken, verifyJWT)

    const id = payload.sub
    const email = payload.email as string | undefined

    if (!id || !email) {
      return res.status(401).json({ error: 'Invalid token claims' })
    }

    req.user = { id, email }
    next()
  } catch (err) {
    logger.error({ err }, '[requireAuth] JWT verification failed')
    return res.status(401).json({ error: 'Invalid token' })
  }
}
