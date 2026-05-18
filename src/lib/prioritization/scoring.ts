import type { PriorityLevel } from "@prisma/client"

import { PRIORITY_WEIGHTS } from "./constants"
import type { PriorityCandidate, PriorityScoreResult } from "./types"

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function priorityLevelFromScore(score: number): PriorityLevel {
  if (score >= 90) return "CRITICAL"
  if (score >= 70) return "HIGH"
  if (score >= 40) return "MEDIUM"
  if (score >= 15) return "LOW"
  return "BACKLOG"
}

export function calculatePriorityScore(candidate: PriorityCandidate): PriorityScoreResult {
  const weighted =
    candidate.urgencyScore * PRIORITY_WEIGHTS.urgency +
    candidate.complianceScore * PRIORITY_WEIGHTS.compliance +
    candidate.relationshipScore * PRIORITY_WEIGHTS.relationship +
    candidate.commercialScore * PRIORITY_WEIGHTS.commercial +
    candidate.freshnessScore * PRIORITY_WEIGHTS.freshness +
    candidate.effortScore * PRIORITY_WEIGHTS.effort

  let score = clamp(weighted)

  if (candidate.guardrails?.forceScore !== undefined) {
    score = clamp(candidate.guardrails.forceScore)
  }

  if (candidate.guardrails?.minScore !== undefined) {
    score = Math.max(score, candidate.guardrails.minScore)
  }

  if (candidate.guardrails?.maxScore !== undefined) {
    score = Math.min(score, candidate.guardrails.maxScore)
  }

  score = clamp(score)

  return {
    score,
    level: priorityLevelFromScore(score),
    urgencyScore: clamp(candidate.urgencyScore),
    complianceScore: clamp(candidate.complianceScore),
    relationshipScore: clamp(candidate.relationshipScore),
    commercialScore: clamp(candidate.commercialScore),
    freshnessScore: clamp(candidate.freshnessScore),
    effortScore: clamp(candidate.effortScore),
  }
}

export function urgencyScoreFromDueDate(dueAt?: Date | null) {
  if (!dueAt) return 20
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueAt)
  due.setHours(0, 0, 0, 0)
  const days = Math.floor((due.getTime() - today.getTime()) / 86_400_000)

  if (days < 0) return 90
  if (days === 0) return 80
  if (days === 1) return 65
  if (days <= 7) return 50
  return 20
}

export function freshnessScoreFromDate(date?: Date | null) {
  if (!date) return 15
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days <= 0) return 80
  if (days <= 2) return 65
  if (days <= 7) return 45
  return 15
}

export function relationshipScoreFromLastContact(date?: Date | null) {
  if (!date) return 80
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (days > 180) return 80
  if (days > 90) return 60
  if (days > 30) return 35
  return 10
}
