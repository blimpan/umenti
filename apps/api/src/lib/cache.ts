import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// 10-minute TTL as a safety net — the primary invalidation mechanism is explicit
// deletion when a teacher saves a content edit.
const MODULE_TTL_SECONDS = 60 * 10

const moduleKey = (moduleId: number) => `module:${moduleId}`

export async function getCachedModule(moduleId: number): Promise<unknown | null> {
  return redis.get(moduleKey(moduleId))
}

export async function setCachedModule(moduleId: number, data: unknown): Promise<void> {
  await redis.set(moduleKey(moduleId), data, { ex: MODULE_TTL_SECONDS })
}

// Accepts one or more module IDs so a concept linked to multiple modules can be
// invalidated in a single call.
export async function invalidateCachedModules(...moduleIds: number[]): Promise<void> {
  if (moduleIds.length === 0) return
  await redis.del(...moduleIds.map(moduleKey))
}
