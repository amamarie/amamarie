type RateLimitOptions = {
  key: string
  limit: number
  windowMs: number
}

const buckets = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
  const now = Date.now()
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt }
  }

  current.count += 1
  buckets.set(key, current)
  return { allowed: true, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt }
}

export function assertRateLimit(options: RateLimitOptions) {
  const result = checkRateLimit(options)
  if (!result.allowed) {
    throw new Error("RATE_LIMITED")
  }
  return result
}

export function rateLimitKey(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(":")
}
