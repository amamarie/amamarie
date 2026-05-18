import type { FinancialProductStatus, FinancialProductType, InsuranceAnalysisStatus, InsuranceAnalysisType } from "@prisma/client"

import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"

const insuranceProductTypes = new Set<FinancialProductType>([
  "LIFE_INSURANCE",
  "DISABILITY_INSURANCE",
  "CRITICAL_ILLNESS",
  "HEALTH_INSURANCE",
  "GROUP_INSURANCE",
  "LONG_TERM_CARE",
  "TRAVEL_INSURANCE",
  "OTHER_INSURANCE",
])

const blockedSubmissionStatuses = new Set<InsuranceAnalysisStatus>([
  "NOT_STARTED",
  "DRAFT",
  "MISSING_DATA",
  "IN_ANALYSIS",
  "ADVISOR_REVIEW",
  "WAITING_CLIENT",
  "NEEDS_UPDATE",
])

const submissionReadyStatuses = new Set<InsuranceAnalysisStatus>([
  "RECOMMENDATION_PREPARED",
  "COMPLETED",
  "DELIVERED",
  "USED_FOR_SUBMISSION",
])

function analysisTypesForProductType(type: FinancialProductType): InsuranceAnalysisType[] {
  if (type === "LIFE_INSURANCE" || type === "GROUP_INSURANCE" || type === "LONG_TERM_CARE" || type === "TRAVEL_INSURANCE" || type === "OTHER_INSURANCE") return ["LIFE", "REPLACEMENT"]
  if (type === "DISABILITY_INSURANCE") return ["DISABILITY", "REPLACEMENT"]
  if (type === "CRITICAL_ILLNESS" || type === "HEALTH_INSURANCE") return ["CRITICAL_ILLNESS", "REPLACEMENT"]
  return ["LIFE", "DISABILITY", "CRITICAL_ILLNESS", "REPLACEMENT"]
}

export function isInsuranceProductType(type: FinancialProductType) {
  return insuranceProductTypes.has(type)
}

export async function findPotentialReplacementPolicy({
  organizationId,
  clientId,
  productType,
  proposedProductId,
}: {
  organizationId: string
  clientId: string
  productType: FinancialProductType
  proposedProductId?: string | null
}) {
  if (!isInsuranceProductType(productType)) return null
  return prisma.financialProduct.findFirst({
    where: {
      organizationId,
      clientId,
      category: "INSURANCE",
      type: productType,
      status: { in: ["ACTIVE", "UNDER_REVIEW", "LAPSED"] },
      ...(proposedProductId ? { id: { not: proposedProductId } } : {}),
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      company: true,
      productName: true,
      policyNumber: true,
      contractNumber: true,
      premium: true,
      coverageAmount: true,
      issuedAt: true,
      effectiveDate: true,
      primaryBeneficiary: true,
      contingentBeneficiary: true,
      beneficiaryNotes: true,
      notes: true,
      complianceNotes: true,
    },
  })
}

export function insuranceAnalysisOpportunityLabel(status?: InsuranceAnalysisStatus | null) {
  if (!status) return { label: "Analyse des besoins : Non liée", tone: "amber" as const }
  if (status === "MISSING_DATA") return { label: "Analyse des besoins : Données manquantes", tone: "rose" as const }
  if (status === "ADVISOR_REVIEW") return { label: "Analyse des besoins : En révision conseiller", tone: "amber" as const }
  if (status === "WAITING_CLIENT") return { label: "Analyse des besoins : En attente client", tone: "amber" as const }
  if (status === "DELIVERED") return { label: "Analyse des besoins : Remise au client", tone: "emerald" as const }
  if (status === "USED_FOR_SUBMISSION") return { label: "Analyse des besoins : Utilisée pour soumission", tone: "violet" as const }
  if (submissionReadyStatuses.has(status)) return { label: "Analyse des besoins : Prête", tone: "emerald" as const }
  return { label: "Analyse des besoins : À compléter", tone: "amber" as const }
}

export async function findBestAnalysisForOpportunity({
  organizationId,
  clientId,
  productType,
  opportunityId,
}: {
  organizationId: string
  clientId: string
  productType: FinancialProductType
  opportunityId?: string | null
}) {
  const analysisTypes = analysisTypesForProductType(productType)
  const linked = opportunityId
    ? await prisma.insuranceNeedsAnalysis.findFirst({
        where: { organizationId, clientId, opportunityId, analysisType: { in: analysisTypes }, status: { not: "ARCHIVED" } },
        orderBy: [{ updatedAt: "desc" }, { analysisDate: "desc" }],
      })
    : null
  if (linked) return linked

  return prisma.insuranceNeedsAnalysis.findFirst({
    where: { organizationId, clientId, opportunityId: null, analysisType: { in: analysisTypes }, status: { not: "ARCHIVED" } },
    orderBy: [
      { signedAt: "desc" },
      { deliveredAt: "desc" },
      { updatedAt: "desc" },
      { analysisDate: "desc" },
    ],
  })
}

async function linkAnalysisToOpportunity({
  organizationId,
  userId,
  analysisId,
  opportunityId,
  clientId,
}: {
  organizationId: string
  userId?: string | null
  analysisId: string
  opportunityId: string
  clientId: string
}) {
  await prisma.insuranceNeedsAnalysis.update({
    where: { id: analysisId },
    data: { opportunityId },
  })
  await prisma.auditLog.create({
    data: {
      organizationId,
      userId,
      clientId,
      entityType: "InsuranceNeedsAnalysis",
      entityId: analysisId,
      action: "OPPORTUNITY_LINKED",
      newValue: { opportunityId },
    },
  })
}

export async function syncInsuranceOpportunityAnalysis({
  organizationId,
  userId,
  productId,
}: {
  organizationId: string
  userId?: string | null
  productId: string
}) {
  const product = await prisma.financialProduct.findFirst({
    where: { id: productId, organizationId },
    select: { id: true, clientId: true, type: true, category: true, status: true },
  })
  if (!product || product.category !== "INSURANCE" || !isInsuranceProductType(product.type)) return null

  const analysis = await findBestAnalysisForOpportunity({
    organizationId,
    clientId: product.clientId,
    productType: product.type,
    opportunityId: product.id,
  })
  if (!analysis) return null

  if (analysis.opportunityId !== product.id) {
    await linkAnalysisToOpportunity({ organizationId, userId, analysisId: analysis.id, opportunityId: product.id, clientId: product.clientId })
  }

  if (product.status === "PENDING" && submissionReadyStatuses.has(analysis.status)) {
    if (analysis.status !== "USED_FOR_SUBMISSION") {
      await prisma.insuranceNeedsAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: "USED_FOR_SUBMISSION",
          usedForRecommendation: true,
        },
      })
      await prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          clientId: product.clientId,
          entityType: "InsuranceNeedsAnalysis",
          entityId: analysis.id,
          action: "USED_FOR_SUBMISSION",
          newValue: { opportunityId: product.id, previousStatus: analysis.status },
        },
      })
    }
    await prisma.financialProduct.update({
      where: { id: product.id },
      data: {
        status: "UNDER_REVIEW",
        complianceNotes: "Analyse des besoins prête; opportunité passée en proposition en préparation.",
      },
    })
    await createCrmActivity({
      organizationId,
      userId,
      clientId: product.clientId,
      productId: product.id,
      type: "PRODUCT_STATUS_CHANGED",
      title: "Opportunité passée en proposition",
      description: "Analyse des besoins prête; proposition en préparation.",
      source: "AUTOMATION",
      entityType: "FinancialProduct",
      entityId: product.id,
      metadata: { analysisId: analysis.id, analysisStatus: "USED_FOR_SUBMISSION", previousAnalysisStatus: analysis.status },
    })
  }

  return analysis
}

export async function syncOpportunityFromAnalysis({
  organizationId,
  userId,
  analysisId,
}: {
  organizationId: string
  userId?: string | null
  analysisId: string
}) {
  const analysis = await prisma.insuranceNeedsAnalysis.findFirst({
    where: { id: analysisId, organizationId },
    select: { id: true, clientId: true, opportunityId: true, status: true },
  })
  if (!analysis?.opportunityId || !submissionReadyStatuses.has(analysis.status)) return null

  const product = await prisma.financialProduct.findFirst({
    where: { id: analysis.opportunityId, organizationId, status: "PENDING" },
    select: { id: true },
  })
  if (!product) return analysis

  if (analysis.status !== "USED_FOR_SUBMISSION") {
    await prisma.insuranceNeedsAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: "USED_FOR_SUBMISSION",
        usedForRecommendation: true,
      },
    })
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        clientId: analysis.clientId,
        entityType: "InsuranceNeedsAnalysis",
        entityId: analysis.id,
        action: "USED_FOR_SUBMISSION",
        newValue: { opportunityId: product.id, previousStatus: analysis.status },
      },
    })
  }
  await prisma.financialProduct.update({
    where: { id: product.id },
    data: {
      status: "UNDER_REVIEW",
      complianceNotes: "Analyse des besoins prête; opportunité passée en proposition en préparation.",
    },
  })
  await createCrmActivity({
    organizationId,
    userId,
    clientId: analysis.clientId,
    productId: product.id,
    type: "PRODUCT_STATUS_CHANGED",
    title: "Opportunité passée en proposition",
    description: "Analyse des besoins prête; proposition en préparation.",
    source: "AUTOMATION",
    entityType: "InsuranceNeedsAnalysis",
    entityId: analysis.id,
    metadata: { analysisId: analysis.id, analysisStatus: "USED_FOR_SUBMISSION", previousAnalysisStatus: analysis.status },
  })

  return analysis
}

export async function assertInsuranceOpportunityCanUseAnalysis({
  organizationId,
  userId,
  clientId,
  productType,
  opportunityId,
  targetStatus,
}: {
  organizationId: string
  userId?: string | null
  clientId: string
  productType: FinancialProductType
  opportunityId?: string | null
  targetStatus?: FinancialProductStatus | null
}) {
  if (!targetStatus || !["UNDER_REVIEW", "ACTIVE"].includes(targetStatus)) return null
  if (!isInsuranceProductType(productType)) return null

  const potentialReplacement = opportunityId
    ? await findPotentialReplacementPolicy({ organizationId, clientId, productType, proposedProductId: opportunityId })
    : null
  if (potentialReplacement) {
    const replacementAnalysis = await prisma.insuranceNeedsAnalysis.findFirst({
      where: {
        organizationId,
        clientId,
        analysisType: "REPLACEMENT",
        status: { not: "ARCHIVED" },
        ...(opportunityId ? { OR: [{ opportunityId }, { opportunityId: null }] } : {}),
      },
      orderBy: [
        { signedAt: "desc" },
        { deliveredAt: "desc" },
        { updatedAt: "desc" },
      ],
    })
    if (!replacementAnalysis) {
      throw new Error("INSURANCE_REPLACEMENT_ANALYSIS_REQUIRED")
    }
    if (opportunityId && replacementAnalysis.opportunityId !== opportunityId) {
      await linkAnalysisToOpportunity({ organizationId, userId, analysisId: replacementAnalysis.id, opportunityId, clientId })
    }
    if (blockedSubmissionStatuses.has(replacementAnalysis.status) || !submissionReadyStatuses.has(replacementAnalysis.status)) {
      throw new Error(`INSURANCE_REPLACEMENT_ANALYSIS_BLOCKED:${replacementAnalysis.status}`)
    }
  }

  const analysis = await findBestAnalysisForOpportunity({ organizationId, clientId, productType, opportunityId })
  if (!analysis) {
    throw new Error("INSURANCE_ANALYSIS_REQUIRED")
  }

  if (opportunityId && analysis.opportunityId !== opportunityId) {
    await linkAnalysisToOpportunity({ organizationId, userId, analysisId: analysis.id, opportunityId, clientId })
  }

  if (targetStatus === "UNDER_REVIEW") {
    if (blockedSubmissionStatuses.has(analysis.status) || !submissionReadyStatuses.has(analysis.status)) {
      throw new Error(`INSURANCE_ANALYSIS_BLOCKED:${analysis.status}`)
    }
    if (!opportunityId) return analysis
    await prisma.insuranceNeedsAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: "USED_FOR_SUBMISSION",
        usedForRecommendation: true,
      },
    })
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        clientId,
        entityType: "InsuranceNeedsAnalysis",
        entityId: analysis.id,
        action: "USED_FOR_SUBMISSION",
        newValue: { opportunityId, previousStatus: analysis.status },
      },
    })
    return analysis
  }

  if (targetStatus === "ACTIVE" && ((!analysis.signedAt && !analysis.clientConfirmedAt) || !["DELIVERED", "USED_FOR_SUBMISSION"].includes(analysis.status))) {
    throw new Error(`INSURANCE_ANALYSIS_DELIVERY_BLOCKED:${analysis.status}`)
  }

  return analysis
}
