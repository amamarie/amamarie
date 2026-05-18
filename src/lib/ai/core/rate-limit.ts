import { AI_LIMITS } from "./config"

const minuteHits = new Map<string, number[]>()
const dayHits = new Map<string, number[]>()

function prune(values: number[], windowMs: number) {
  const cutoff = Date.now() - windowMs
  return values.filter((value) => value >= cutoff)
}

export class AIRateLimitError extends Error {
  constructor() {
    super("Limite IA atteinte. Réessayez plus tard.")
    this.name = "AIRateLimitError"
  }
}

export function enforceAIRateLimit(userId: string) {
  const minute = prune(minuteHits.get(userId) ?? [], 60_000)
  const day = prune(dayHits.get(userId) ?? [], 86_400_000)

  if (minute.length >= AI_LIMITS.perMinutePerUser || day.length >= AI_LIMITS.perDayPerUser) {
    throw new AIRateLimitError()
  }

  minute.push(Date.now())
  day.push(Date.now())
  minuteHits.set(userId, minute)
  dayHits.set(userId, day)
}
