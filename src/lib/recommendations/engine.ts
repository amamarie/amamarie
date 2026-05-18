import type { ProductRecommendationPriority, ProductRecommendationStatus } from "@prisma/client"

import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { assertActivePurposeConsent } from "@/lib/privacy/service"
import { dedupeRecommendations, recommendationDedupeKey } from "@/lib/recommendations/dedupe"
import { runRecommendationRules } from "@/lib/recommendations/rules"
import type { RecommendationCandidate } from "@/lib/recommendations/types"

const activeRecommendationStatuses: ProductRecommendationStatus[] = [
  "OPEN",
  "DRAFT",
  "MISSING_DATA",
  "OPTIONS_REQUIRED",
  "ADVISOR_REVIEW",
  "REVIEWED",
  "COMPLIANCE_REVIEW_REQUIRED",
  "ADVISOR_APPROVED",
  "COMPLIANCE_APPROVED",
  "PRESENTED_TO_CLIENT",
]

function notificationTypeForPriority(priority: ProductRecommendationPriority) {
  return priority === "CRITICAL" ? "ALERT" : "WARNING"
}

async function notifyPriorityRecommendation({
  organizationId,
  userId,
  clientId,
  clientName,
  title,
  priority,
}: {
  organizationId: string
  userId?: string | null
  clientId: string
  clientName: string
  title: string
  priority: ProductRecommendationPriority
}) {
  if (!["HIGH", "CRITICAL"].includes(priority)) return

  await prisma.notification.create({
    data: {
      organizationId,
      userId,
      type: notificationTypeForPriority(priority),
      title: "Nouvelle recommandation prioritaire",
      message: `${clientName}: ${title}`,
      href: `/clients/${clientId}`,
    },
  })
}

export async function generateRecommendationsForClient({
  organizationId,
  clientId,
  advisorId,
  userId,
}: {
  organizationId: string
  clientId: string
  advisorId?: string | null
  userId?: string | null
}) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    include: {
      products: true,
      documents: true,
      tasks: true,
      noteItems: true,
      activities: true,
    },
  })

  if (!client) {
    throw new Error("Client introuvable.")
  }
  await assertActivePurposeConsent({
    organizationId,
    clientId,
    purposeCode: "kyc_use",
    errorCode: "KYC_USE_CONSENT_REQUIRED",
  })
  await assertActivePurposeConsent({
    organizationId,
    clientId,
    purposeCode: "insurance_needs_analysis",
    errorCode: "INSURANCE_ANALYSIS_CONSENT_REQUIRED",
  })

  const candidates = dedupeRecommendations(
    runRecommendationRules({
      client,
      products: client.products,
      documents: client.documents,
      tasks: client.tasks,
    })
  )

  const candidateKeys = new Set(candidates.map(recommendationDedupeKey))
  const existingActive = await prisma.productRecommendation.findMany({
    where: {
      organizationId,
      clientId,
      status: { in: activeRecommendationStatuses },
    },
  })

  const existingByKey = new Map(
    existingActive.map((recommendation) => [
      recommendationDedupeKey({
        ruleKey: recommendation.ruleKey,
        relatedProductId: recommendation.relatedProductId,
      } as RecommendationCandidate),
      recommendation,
    ])
  )

  const clientName = `${client.firstName} ${client.lastName}`

  for (const candidate of candidates) {
    const key = recommendationDedupeKey(candidate)
    const existing = existingByKey.get(key)

    if (existing) {
      await prisma.productRecommendation.update({
        where: { id: existing.id },
        data: {
          type: candidate.type,
          priority: candidate.priority,
          title: candidate.title,
          description: candidate.description,
          rationale: candidate.rationale,
          actionLabel: candidate.actionLabel,
          actionUrl: candidate.actionUrl,
          confidence: candidate.confidence,
          metadata: candidate.metadata,
          advisorId: advisorId ?? client.advisorId ?? existing.advisorId,
        },
      })
      continue
    }

    const recommendation = await prisma.productRecommendation.create({
      data: {
        organizationId,
        clientId,
        advisorId: advisorId ?? client.advisorId ?? null,
        type: candidate.type,
        priority: candidate.priority,
        title: candidate.title,
        description: candidate.description,
        rationale: candidate.rationale,
        actionLabel: candidate.actionLabel,
        actionUrl: candidate.actionUrl,
        relatedProductId: candidate.relatedProductId,
        ruleKey: candidate.ruleKey,
        confidence: candidate.confidence,
        metadata: candidate.metadata,
      },
    })

    await createCrmActivity({
      organizationId,
      userId,
      clientId,
      type: "RECOMMENDATION_CREATED",
      title: "Recommandation créée",
      description: recommendation.title,
    })

    await notifyPriorityRecommendation({
      organizationId,
      userId: advisorId ?? client.advisorId ?? userId,
      clientId,
      clientName,
      title: recommendation.title,
      priority: recommendation.priority,
    })
  }

  const staleRecommendations = existingActive.filter((recommendation) => {
    const key = recommendationDedupeKey({
      ruleKey: recommendation.ruleKey,
      relatedProductId: recommendation.relatedProductId,
    } as RecommendationCandidate)
    return !candidateKeys.has(key)
  })

  if (staleRecommendations.length > 0) {
    await prisma.productRecommendation.updateMany({
      where: { id: { in: staleRecommendations.map((recommendation) => recommendation.id) } },
      data: { status: "ARCHIVED" },
    })
  }

  await createCrmActivity({
    organizationId,
    userId,
    clientId,
    type: "RECOMMENDATIONS_GENERATED",
    title: "Recommandations recalculées",
    description: `${candidates.length} piste(s) de suivi active(s) selon les règles internes.`,
  })

  return prisma.productRecommendation.findMany({
    where: { organizationId, clientId },
    include: {
      client: true,
      advisor: true,
      relatedProduct: true,
    },
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
  })
}
