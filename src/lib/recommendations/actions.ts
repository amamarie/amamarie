import type { ProductRecommendationPriority } from "@prisma/client"

import { createCrmActivity } from "@/lib/crm-events"
import { ensureKycVersionForRecommendation } from "@/lib/compliance/kyc-advanced"
import { assertKycReadyForRecommendation } from "@/lib/compliance/kyc-engine"
import { syncOpportunityFromAnalysis } from "@/lib/insurance-needs/opportunity-sync"
import { prisma } from "@/lib/prisma"

function dueDateForPriority(priority: ProductRecommendationPriority) {
  const date = new Date()
  const days =
    priority === "CRITICAL" ? 0 : priority === "HIGH" ? 3 : priority === "MEDIUM" ? 7 : 14
  date.setDate(date.getDate() + days)
  return date
}

function taskPriorityForRecommendation(priority: ProductRecommendationPriority) {
  if (priority === "CRITICAL") return "URGENT"
  if (priority === "HIGH") return "HIGH"
  if (priority === "MEDIUM") return "NORMAL"
  return "LOW"
}

async function getRecommendation(id: string, organizationId: string) {
  return prisma.productRecommendation.findFirst({
    where: { id, organizationId },
    include: { client: { include: { kycProfile: true } }, relatedProduct: true },
  })
}

function assertClientKycReadyForRecommendation(recommendation: Awaited<ReturnType<typeof getRecommendation>>) {
  if (!recommendation) return
  assertKycReadyForRecommendation(recommendation.client.kycProfile)
}

function getInsuranceAnalysisId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const value = (metadata as { analysisId?: unknown }).analysisId
  return typeof value === "string" && value.length > 0 ? value : null
}

async function assertRecommendationInsuranceAnalysisIsReady({
  organizationId,
  userId,
  recommendationId,
  metadata,
}: {
  organizationId: string
  userId?: string | null
  recommendationId: string
  metadata: unknown
}) {
  const analysisId = getInsuranceAnalysisId(metadata)
  if (!analysisId) return null

  const analysis = await prisma.insuranceNeedsAnalysis.findFirst({
    where: { id: analysisId, organizationId, status: { not: "ARCHIVED" } },
    select: { id: true, clientId: true, status: true, usedForRecommendation: true, opportunityId: true },
  })
  if (!analysis) throw new Error("INSURANCE_ANALYSIS_NOT_FOUND")

  const blockedStatuses = new Set(["NOT_STARTED", "DRAFT", "MISSING_DATA", "IN_ANALYSIS", "ADVISOR_REVIEW", "WAITING_CLIENT", "NEEDS_UPDATE"])
  if (blockedStatuses.has(analysis.status)) throw new Error(`INSURANCE_ANALYSIS_RECOMMENDATION_BLOCKED:${analysis.status}`)

  if (!analysis.usedForRecommendation || analysis.status === "RECOMMENDATION_PREPARED" || analysis.status === "COMPLETED") {
    await prisma.insuranceNeedsAnalysis.update({
      where: { id: analysis.id },
      data: {
        usedForRecommendation: true,
        status: analysis.status === "RECOMMENDATION_PREPARED" || analysis.status === "COMPLETED" ? "USED_FOR_SUBMISSION" : analysis.status,
      },
    })
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        clientId: analysis.clientId,
        entityType: "InsuranceNeedsAnalysis",
        entityId: analysis.id,
        action: "RECOMMENDATION_COMPLETED",
        newValue: { recommendationId, previousStatus: analysis.status, opportunityId: analysis.opportunityId },
      },
    })
  }

  await syncOpportunityFromAnalysis({ organizationId, userId, analysisId: analysis.id })
  return analysis
}

async function linkRecommendationToKycVersion({
  organizationId,
  userId,
  recommendation,
}: {
  organizationId: string
  userId?: string | null
  recommendation: NonNullable<Awaited<ReturnType<typeof getRecommendation>>>
}) {
  if (recommendation.sourceKycVersionId) return recommendation.sourceKycVersionId
  const version = await ensureKycVersionForRecommendation({
    organizationId,
    clientId: recommendation.clientId,
    userId,
  })
  if (!version) return null
  await prisma.productRecommendation.update({
    where: { id: recommendation.id },
    data: { sourceKycVersionId: version.id },
  })
  await prisma.kycVersion.update({
    where: { id: version.id },
    data: { usedForRecommendationAt: new Date() },
  })
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      clientId: recommendation.clientId,
      entityType: "KycVersion",
      entityId: version.id,
      action: "KYC_VERSION_LINKED_TO_RECOMMENDATION",
      newValue: { recommendationId: recommendation.id, versionNumber: version.versionNumber },
    },
  })
  return version.id
}

export async function markRecommendationReviewed({
  id,
  organizationId,
  userId,
}: {
  id: string
  organizationId: string
  userId?: string | null
}) {
  const recommendation = await getRecommendation(id, organizationId)
  if (!recommendation) throw new Error("Recommandation introuvable.")
  assertClientKycReadyForRecommendation(recommendation)
  await linkRecommendationToKycVersion({ organizationId, userId, recommendation })
  await assertRecommendationInsuranceAnalysisIsReady({
    organizationId,
    userId,
    recommendationId: recommendation.id,
    metadata: recommendation.metadata,
  })

  const updated = await prisma.productRecommendation.update({
    where: { id },
    data: { status: "REVIEWED", reviewedAt: new Date() },
  })

  await createCrmActivity({
    organizationId,
    userId,
    clientId: recommendation.clientId,
    type: "RECOMMENDATION_REVIEWED",
    title: "Recommandation consultée",
    description: recommendation.title,
  })

  return updated
}

export async function dismissRecommendation({
  id,
  organizationId,
  userId,
  reason,
}: {
  id: string
  organizationId: string
  userId?: string | null
  reason?: string
}) {
  const recommendation = await getRecommendation(id, organizationId)
  if (!recommendation) throw new Error("Recommandation introuvable.")
  assertClientKycReadyForRecommendation(recommendation)

  const updated = await prisma.productRecommendation.update({
    where: { id },
    data: {
      status: "DISMISSED",
      dismissedAt: new Date(),
      metadata: {
        ...(typeof recommendation.metadata === "object" && recommendation.metadata !== null
          ? recommendation.metadata
          : {}),
        dismissalReason: reason,
      },
    },
  })

  await createCrmActivity({
    organizationId,
    userId,
    clientId: recommendation.clientId,
    type: "RECOMMENDATION_DISMISSED",
    title: "Recommandation ignorée",
    description: reason ? `${recommendation.title} - ${reason}` : recommendation.title,
  })

  return updated
}

export async function completeRecommendation({
  id,
  organizationId,
  userId,
}: {
  id: string
  organizationId: string
  userId?: string | null
}) {
  const recommendation = await getRecommendation(id, organizationId)
  if (!recommendation) throw new Error("Recommandation introuvable.")
  assertClientKycReadyForRecommendation(recommendation)
  await linkRecommendationToKycVersion({ organizationId, userId, recommendation })

  const updated = await prisma.productRecommendation.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  })

  await createCrmActivity({
    organizationId,
    userId,
    clientId: recommendation.clientId,
    type: "RECOMMENDATION_COMPLETED",
    title: "Recommandation complétée",
    description: recommendation.title,
  })

  return updated
}

export async function convertRecommendationToTask({
  id,
  organizationId,
  userId,
  assignedToId,
  dueDate,
  taskTitle,
}: {
  id: string
  organizationId: string
  userId?: string | null
  assignedToId?: string
  dueDate?: Date
  taskTitle?: string
}) {
  const recommendation = await getRecommendation(id, organizationId)
  if (!recommendation) throw new Error("Recommandation introuvable.")

  if (assignedToId) {
    const assignee = await prisma.user.findFirst({
      where: { id: assignedToId, organizationId },
      select: { id: true },
    })
    if (!assignee) throw new Error("Conseiller assigné introuvable.")
  }

  const task = await prisma.task.create({
    data: {
      organizationId,
      clientId: recommendation.clientId,
      assignedToId: assignedToId ?? recommendation.advisorId ?? userId ?? undefined,
      title: taskTitle ?? recommendation.actionLabel ?? recommendation.title,
      description: [
        recommendation.description,
        recommendation.rationale,
        "Piste interne seulement: la décision et l’analyse finale appartiennent au conseiller.",
      ]
        .filter(Boolean)
        .join("\n\n"),
      priority: taskPriorityForRecommendation(recommendation.priority),
      dueDate: dueDate ?? dueDateForPriority(recommendation.priority),
    },
  })

  const updated = await prisma.productRecommendation.update({
    where: { id },
    data: {
      status: "CONVERTED_TO_TASK",
      relatedTaskId: task.id,
    },
  })

  await createCrmActivity({
    organizationId,
    userId,
    clientId: recommendation.clientId,
    type: "RECOMMENDATION_CONVERTED_TO_TASK",
    title: "Recommandation convertie en tâche",
    description: task.title,
  })

  await prisma.notification.create({
    data: {
      organizationId,
      userId: task.assignedToId,
      type: "INFO",
      title: "Tâche créée depuis une recommandation",
      message: task.title,
      href: `/clients/${recommendation.clientId}`,
    },
  })

  return { recommendation: updated, task }
}
