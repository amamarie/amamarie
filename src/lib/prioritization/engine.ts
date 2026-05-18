import { Prisma, type PriorityEntityType } from "@prisma/client"

import { prisma } from "@/lib/prisma"

import { collectPriorityCandidates } from "./collectors"
import { calculatePriorityScore } from "./scoring"
import type { PriorityGenerationResult } from "./types"

export async function generatePriorityItemsForOrganization({
  organizationId,
  advisorId,
  triggeredById,
  clientId,
}: {
  organizationId: string
  advisorId?: string
  triggeredById?: string
  clientId?: string
}): Promise<PriorityGenerationResult> {
  const startedAt = Date.now()
  const scope = clientId ? "client" : advisorId ? "advisor" : "organization"
  const run = await prisma.priorityRun.create({
    data: { organizationId, triggeredById, scope },
  })

  try {
    const candidates = await collectPriorityCandidates({ organizationId, advisorId, clientId })
    const activeKeys = new Set(candidates.map((candidate) => `${candidate.entityType}:${candidate.entityId}`))
    let createdCount = 0
    let updatedCount = 0

    for (const candidate of candidates) {
      const score = calculatePriorityScore(candidate)
      const existing = await prisma.priorityItem.findUnique({
        where: {
          organizationId_entityType_entityId: {
            organizationId,
            entityType: candidate.entityType,
            entityId: candidate.entityId,
          },
        },
      })

      const data = {
        advisorId: candidate.advisorId ?? null,
        clientId: candidate.clientId ?? null,
        leadId: candidate.leadId ?? null,
        level: score.level,
        status: "ACTIVE" as const,
        score: score.score,
        urgencyScore: score.urgencyScore,
        complianceScore: score.complianceScore,
        relationshipScore: score.relationshipScore,
        commercialScore: score.commercialScore,
        freshnessScore: score.freshnessScore,
        effortScore: score.effortScore,
        title: candidate.title,
        description: candidate.description ?? null,
        reason: candidate.reason,
        suggestedAction: candidate.suggestedAction,
        actionUrl: candidate.actionUrl ?? null,
        dueAt: candidate.dueAt ?? null,
        metadata: (candidate.metadata ?? {}) as Prisma.InputJsonValue,
        calculatedAt: new Date(),
      }

      if (existing) {
        await prisma.priorityItem.update({ where: { id: existing.id }, data })
        updatedCount += 1
      } else {
        await prisma.priorityItem.create({
          data: {
            organizationId,
            entityType: candidate.entityType,
            entityId: candidate.entityId,
            ...data,
          },
        })
        createdCount += 1
      }
    }

    const archiveWhere: Prisma.PriorityItemWhereInput = {
      organizationId,
      status: { in: ["ACTIVE", "SNOOZED"] },
      ...(clientId ? { clientId } : {}),
      ...(advisorId ? { advisorId } : {}),
    }
    if (candidates.length) {
      archiveWhere.NOT = {
        OR: Array.from(activeKeys).map((key) => {
          const [entityType, entityId] = key.split(":")
          return { entityType: entityType as PriorityEntityType, entityId }
        }),
      }
    }

    const archived = await prisma.priorityItem.updateMany({
      where: archiveWhere,
      data: { status: "ARCHIVED" },
    })

    const durationMs = Date.now() - startedAt
    await prisma.priorityRun.update({
      where: { id: run.id },
      data: {
        entityCount: candidates.length,
        createdCount,
        updatedCount,
        archivedCount: archived.count,
        durationMs,
        completedAt: new Date(),
      },
    })

    return { entityCount: candidates.length, createdCount, updatedCount, archivedCount: archived.count, durationMs }
  } catch (error) {
    await prisma.priorityRun.update({
      where: { id: run.id },
      data: { error: error instanceof Error ? error.message : "Erreur inconnue", completedAt: new Date(), durationMs: Date.now() - startedAt },
    })
    throw error
  }
}

export function generatePriorityItemsForClient({ organizationId, clientId, triggeredById }: { organizationId: string; clientId: string; triggeredById?: string }) {
  return generatePriorityItemsForOrganization({ organizationId, clientId, triggeredById })
}

export function generatePriorityItemsForAdvisor({ organizationId, advisorId, triggeredById }: { organizationId: string; advisorId: string; triggeredById?: string }) {
  return generatePriorityItemsForOrganization({ organizationId, advisorId, triggeredById })
}
