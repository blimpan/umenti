import { createClient } from '@supabase/supabase-js'
import { Request, Response, NextFunction } from 'express'

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string }
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    // Extract the Bearer token from the Authorization header
    const bearerToken = req.headers.authorization?.split(' ')[1] // we do this because the header is in the format "Bearer <token>"
    if (!bearerToken) {
      return res.status(401).json({ error: 'Missing Authorization header' })
    }

    // Call supabase.auth.getUser(token) to verify it
    const { data: { user }, error } = await supabase.auth.getUser(bearerToken)
    if (error || !user) { 
        // On failure (missing token, invalid token, Supabase error): return 401
        return res.status(401).json({ error: 'Invalid token' })
    }
  
  if (!user.email) { 
    return res.status(400).json({ error: 'User email not found' })
  }

  if (!user.id) {
    return res.status(400).json({ error: 'User ID not found' })
  }

    // n success: attach { id, email } to req.user and call next()
    req.user = { id: user.id, email: user.email }
    next() // call next() to pass control to the next middleware or route handler. If we don't, the request will stop here.

}
