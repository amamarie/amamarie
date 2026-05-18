import { createHash } from "crypto"

type CacheEntry = {
  expiresAt: number
  value: unknown
}

const cache = new Map<string, CacheEntry>()

export function createAIHash(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex")
}

export function getAICache<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.value as T
}

export function setAICache(key: string, value: unknown, ttlMs = 5 * 60 * 1000) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs })
}
