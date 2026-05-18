import type { RecommendationPriority } from "@/lib/recommendations/types"

export function priorityFromDaysUntil(days: number | null, fallback: RecommendationPriority = "MEDIUM") {
  if (days === null) return fallback
  if (days <= 7) return "CRITICAL"
  if (days <= 15) return "HIGH"
  if (days <= 30) return "MEDIUM"
  return fallback
}

export function priorityFromIncome(income?: number | null): RecommendationPriority {
  if (!income) return "MEDIUM"
  return income >= 100000 ? "HIGH" : "MEDIUM"
}

export function confidence(base: number, modifiers: number[] = []) {
  const value = modifiers.reduce((sum, modifier) => sum + modifier, base)
  return Math.max(0, Math.min(1, Number(value.toFixed(2))))
}
