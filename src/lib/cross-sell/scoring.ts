import type { CrossSellPriority } from "@/lib/cross-sell/types"

export function priorityFromScore(score: number): CrossSellPriority {
  if (score >= 90) return "CRITICAL"
  if (score >= 70) return "HIGH"
  if (score >= 40) return "MEDIUM"
  return "LOW"
}

export function estimatePriority({
  evidentNeed,
  missingProduct,
  incomeKnown,
  linkedGoal,
  noRecentContact,
  commercialPriority,
  insufficientData,
  dismissedRecently,
}: {
  evidentNeed?: boolean
  missingProduct?: boolean
  incomeKnown?: boolean
  linkedGoal?: boolean
  noRecentContact?: boolean
  commercialPriority?: boolean
  insufficientData?: boolean
  dismissedRecently?: boolean
}) {
  let score = 0
  if (evidentNeed) score += 30
  if (missingProduct) score += 20
  if (incomeKnown) score += 15
  if (linkedGoal) score += 15
  if (noRecentContact) score += 10
  if (commercialPriority) score += 10
  if (insufficientData) score -= 20
  if (dismissedRecently) score -= 30
  score = Math.max(0, Math.min(score, 100))
  return { score, priority: priorityFromScore(score) }
}

export function confidenceFromScore(score: number) {
  return Math.max(0.35, Math.min(0.95, score / 100))
}

export function relevanceLabel(score?: number | null) {
  if (!score) return "À valider"
  if (score >= 70) return "Élevée"
  if (score >= 40) return "Moyenne"
  return "Faible"
}
