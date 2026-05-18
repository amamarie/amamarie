import type { PriorityEntityType, PriorityLevel } from "@prisma/client"

export type PrioritySubScores = {
  urgencyScore: number
  complianceScore: number
  relationshipScore: number
  commercialScore: number
  freshnessScore: number
  effortScore: number
}

export type PriorityCandidate = PrioritySubScores & {
  entityType: PriorityEntityType
  entityId: string
  advisorId?: string | null
  clientId?: string | null
  leadId?: string | null
  title: string
  description?: string | null
  reason: string
  suggestedAction: string
  actionUrl?: string | null
  dueAt?: Date | null
  metadata?: Record<string, unknown>
  guardrails?: {
    minScore?: number
    maxScore?: number
    forceScore?: number
  }
}

export type PriorityScoreResult = PrioritySubScores & {
  score: number
  level: PriorityLevel
}

export type PriorityGenerationResult = {
  entityCount: number
  createdCount: number
  updatedCount: number
  archivedCount: number
  durationMs: number
}
