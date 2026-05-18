import type { FinancialProductCategory, FinancialProductStatus } from "@prisma/client"

import { createCrmActivity } from "@/lib/crm-events"
import { assertKycReadyForRecommendation } from "@/lib/compliance/kyc-engine"
import { evaluateKycProfile } from "@/lib/compliance/kyc-engine"
import { prisma } from "@/lib/prisma"

const recommendationStatuses = new Set<FinancialProductStatus>(["PENDING", "UNDER_REVIEW"])
const pipelineManagedNote = "[AUTO_PROFIL_CLIENT_PIPELINE]"

export async function assertKycAllowsOpportunity({
  organizationId,
  clientId,
  category,
  targetStatus,
}: {
  organizationId: string
  clientId: string
  category: FinancialProductCategory
  targetStatus: FinancialProductStatus
}) {
  if (!recommendationStatuses.has(targetStatus)) return
  if (category !== "INVESTMENT" && category !== "INSURANCE") return

  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    include: { kycProfile: true },
  })
  if (!client) throw new Error("CLIENT_NOT_FOUND")
  try {
    assertKycReadyForRecommendation(client.kycProfile)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("KYC_RECOMMENDATION_BLOCKED")) {
      throw new Error(error.message.replace("KYC_RECOMMENDATION_BLOCKED", "KYC_OPPORTUNITY_BLOCKED"))
    }
    throw error
  }
}

export async function syncKycOpportunityPipeline({
  organizationId,
  clientId,
  userId,
}: {
  organizationId: string
  clientId: string
  userId?: string | null
}) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    include: { kycProfile: true },
  })
  if (!client) return { updated: 0, ready: false }

  const evaluation = evaluateKycProfile(client.kycProfile)
  const products = await prisma.financialProduct.findMany({
    where: {
      organizationId,
      clientId,
      category: { in: ["INVESTMENT", "INSURANCE"] },
      status: { in: ["PENDING", "UNDER_REVIEW"] },
    },
    select: { id: true, status: true, type: true, category: true, policyNumber: true, productName: true, complianceNotes: true },
  })

  let updated = 0
  const reason = evaluation.alerts[0]?.title ?? evaluation.missingFields[0] ?? "Profil client non prêt"

  for (const product of products) {
    if (!evaluation.recommendationReady && product.status === "PENDING") {
      const nextNotes = [
        product.complianceNotes,
        `${pipelineManagedNote} Profil client non prêt: ${reason}. Opportunité placée en révision avant recommandation.`,
      ].filter(Boolean).join("\n")
      await prisma.financialProduct.update({
        where: { id: product.id },
        data: { status: "UNDER_REVIEW", complianceNotes: nextNotes },
      })
      await createCrmActivity({
        organizationId,
        userId,
        clientId,
        productId: product.id,
        type: "PRODUCT_STATUS_CHANGED",
        title: "Opportunité mise en révision",
        description: `Profil client non prêt: ${reason}.`,
        source: "SYSTEM",
        metadata: { reason, previousStatus: product.status, nextStatus: "UNDER_REVIEW", module: "client_profile" },
      })
      updated += 1
      continue
    }

    if (evaluation.recommendationReady && product.status === "UNDER_REVIEW" && product.complianceNotes?.includes(pipelineManagedNote)) {
      const nextNotes = [
        product.complianceNotes,
        `${pipelineManagedNote} Profil client prêt: l’opportunité peut revenir en proposition à préparer.`,
      ].filter(Boolean).join("\n")
      await prisma.financialProduct.update({
        where: { id: product.id },
        data: { status: "PENDING", complianceNotes: nextNotes },
      })
      await createCrmActivity({
        organizationId,
        userId,
        clientId,
        productId: product.id,
        type: "PRODUCT_STATUS_CHANGED",
        title: "Opportunité prête pour proposition",
        description: "Le profil client est confirmé, cohérent et utilisable.",
        source: "SYSTEM",
        metadata: { previousStatus: product.status, nextStatus: "PENDING", module: "client_profile" },
      })
      updated += 1
    }
  }

  return { updated, ready: evaluation.recommendationReady }
}
