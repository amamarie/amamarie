import { fail, handleApiError, ok } from "@/lib/api-response"
import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { ensureInsuranceNeedsDeliveredBeforePolicy } from "@/lib/compliance/insurance-delivery"
import { assertKycAllowsOpportunity } from "@/lib/compliance/kyc-opportunity"
import { assertComplianceWorkflowClear, ComplianceWorkflowBlockedError } from "@/lib/compliance/workflow-guards"
import { generateCrossSellOpportunitiesForClient } from "@/lib/cross-sell/engine"
import { ensureReplacementAnalysisForOpportunity } from "@/lib/insurance-needs/service"
import { assertInsuranceOpportunityCanUseAnalysis, syncInsuranceOpportunityAnalysis } from "@/lib/insurance-needs/opportunity-sync"
import { prisma } from "@/lib/prisma"
import { generateRecommendationsForClient } from "@/lib/recommendations/engine"
import { getTenantContext } from "@/lib/tenant"
import { financialProductUpdateSchema } from "@/lib/validators"

type RouteContext = {
  params: Promise<{ id: string }>
}

function insuranceAnalysisGateMessage(error: Error) {
  if (error.message === "INSURANCE_ANALYSIS_REQUIRED") {
    return "Une analyse des besoins doit être liée à cette opportunité avant de préparer une soumission ou finaliser la police."
  }
  if (error.message === "INSURANCE_REPLACEMENT_ANALYSIS_REQUIRED") {
    return "Un remplacement potentiel est détecté : une analyse de remplacement doit être créée et complétée avant la soumission."
  }
  if (error.message.startsWith("INSURANCE_REPLACEMENT_ANALYSIS_BLOCKED")) {
    const status = error.message.split(":")[1] ?? "incomplète"
    return `La soumission est bloquée : l’analyse de remplacement est au statut ${status}. Elle doit être prête avant la proposition.`
  }
  if (error.message.startsWith("INSURANCE_ANALYSIS_BLOCKED")) {
    const status = error.message.split(":")[1] ?? "incomplète"
    return `La soumission est bloquée : l’analyse des besoins est au statut ${status}. Elle doit être prête avant la proposition.`
  }
  if (error.message.startsWith("INSURANCE_ANALYSIS_DELIVERY_BLOCKED")) {
    const status = error.message.split(":")[1] ?? "non remise"
    return `La livraison est bloquée : le rapport d’analyse des besoins est au statut ${status} et n’est pas confirmé par le client.`
  }
  if (error.message.startsWith("KYC_OPPORTUNITY_BLOCKED")) {
    const reason = error.message.split(":")[1] ?? "profil client non prêt"
    return `L’opportunité est bloquée : ${reason}. Le profil client doit être confirmé, cohérent et utilisable avant recommandation.`
  }
  return null
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const product = await prisma.financialProduct.findFirst({
      where: { id, organizationId },
      include: {
        client: true,
        advisor: true,
        insuranceNeedsAnalyses: {
          where: { status: { not: "ARCHIVED" } },
          orderBy: [{ updatedAt: "desc" }],
          take: 1,
          include: { reportDocument: true },
        },
      },
    })

    if (!product) return fail("NOT_FOUND", "Produit introuvable.", 404)

    return ok(product)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = financialProductUpdateSchema.parse(await request.json())
    const existing = await prisma.financialProduct.findFirst({
      where: { id, organizationId },
      include: { client: { select: { id: true } } },
    })

    if (!existing) {
      return fail("NOT_FOUND", "Produit introuvable.", 404)
    }

    if (payload.clientId && payload.clientId !== existing.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: payload.clientId, organizationId },
        select: { id: true },
      })

      if (!client) {
        return fail("NOT_FOUND", "Le client lié est introuvable.", 404)
      }
    }

    if (payload.advisorId && payload.advisorId !== existing.advisorId) {
      const advisor = await prisma.user.findFirst({
        where: { id: payload.advisorId, organizationId },
        select: { id: true },
      })

      if (!advisor) {
        return fail("NOT_FOUND", "Le conseiller assigné est introuvable.", 404)
      }
    }

    const nextClientId = payload.clientId ?? existing.clientId
    const nextType = payload.type ?? existing.type
    const nextCategory = payload.category ?? existing.category
    const nextStatus = payload.status ?? existing.status
    if (nextCategory === "INSURANCE") {
      await assertInsuranceOpportunityCanUseAnalysis({
        organizationId,
        userId,
        clientId: nextClientId,
        productType: nextType,
        opportunityId: existing.id,
        targetStatus: nextStatus,
      })
    }
    if (["UNDER_REVIEW", "ACTIVE", "TRANSFERRED"].includes(nextStatus)) {
      await assertComplianceWorkflowClear({
        organizationId,
        clientId: nextClientId,
        action: "RECOMMENDATION_LOCK",
      })
    }
    await assertKycAllowsOpportunity({
      organizationId,
      clientId: nextClientId,
      category: nextCategory,
      targetStatus: nextStatus,
    })

    const statusChanged = Boolean(payload.status && payload.status !== existing.status)
    await prisma.financialProduct.updateMany({
      where: { id, organizationId },
      data: payload,
    })
    const product = await prisma.financialProduct.findFirstOrThrow({
      where: { id, organizationId },
    })
    if (product.category === "INSURANCE") {
      await ensureReplacementAnalysisForOpportunity({ organizationId, userId, productId: product.id })
      await syncInsuranceOpportunityAnalysis({ organizationId, userId, productId: product.id })
    }

    await createCrmActivity({
      organizationId,
      userId,
      clientId: product.clientId,
      type: statusChanged ? "PRODUCT_STATUS_CHANGED" : "PRODUCT_UPDATED",
      title: statusChanged ? "Statut du produit modifié" : "Produit financier modifié",
      description: statusChanged
        ? `${existing.status} -> ${product.status}`
        : product.policyNumber ?? product.type,
    })

    await runAutomationsForEvent({
      organizationId,
      userId,
      clientId: product.clientId,
      event: statusChanged ? "PRODUCT_STATUS_CHANGED" : "PRODUCT_UPDATED",
      entityType: "product",
      entityId: product.id,
      title: statusChanged ? "Statut du produit modifié" : "Produit financier modifié",
      description: product.policyNumber ?? product.type,
      payload: { oldStatus: existing.status, newStatus: product.status, status: product.status, type: product.type, category: product.category, productId: product.id },
    })

    await ensureInsuranceNeedsDeliveredBeforePolicy({ organizationId, userId, productId: product.id })

    try {
      await generateRecommendationsForClient({
        organizationId,
        clientId: product.clientId,
        advisorId: product.advisorId ?? userId,
        userId,
      })
    } catch (recommendationError) {
      console.warn({ action: "product_recommendations_failed", productId: product.id, name: recommendationError instanceof Error ? recommendationError.name : "UnknownError" })
    }

    try {
      await generateCrossSellOpportunitiesForClient({
        organizationId,
        clientId: product.clientId,
        advisorId: product.advisorId ?? userId,
        userId,
      })
    } catch (crossSellError) {
      console.warn({ action: "product_cross_sell_failed", productId: product.id, name: crossSellError instanceof Error ? crossSellError.name : "UnknownError" })
    }

    return ok(product)
  } catch (error) {
    if (error instanceof ComplianceWorkflowBlockedError) {
      return fail(
        "COMPLIANCE_WORKFLOW_BLOCKED",
        "L’opportunité est bloquée par la conformité: une alerte AML, plainte, incident, supervision, checklist ou exception doit être résolue.",
        409,
        { blockers: error.blockers },
      )
    }
    if (error instanceof Error) {
      const message = insuranceAnalysisGateMessage(error)
      if (message) return fail("INSURANCE_ANALYSIS_BLOCKED", message, 409)
    }
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const existing = await prisma.financialProduct.findFirst({
      where: { id, organizationId },
      select: { id: true, clientId: true, policyNumber: true, type: true },
    })

    if (!existing) return fail("NOT_FOUND", "Produit introuvable.", 404)

    await prisma.financialProduct.updateMany({
      where: { id, organizationId },
      data: { status: "ARCHIVED" },
    })
    const product = await prisma.financialProduct.findFirstOrThrow({ where: { id, organizationId } })

    await createCrmActivity({
      organizationId,
      userId,
      clientId: existing.clientId,
      type: "PRODUCT_ARCHIVED",
      title: "Produit financier archivé",
      description: existing.policyNumber ?? existing.type,
    })

    try {
      await generateRecommendationsForClient({
        organizationId,
        clientId: existing.clientId,
        userId,
      })
    } catch (recommendationError) {
      console.warn({ action: "product_recommendations_failed", productId: existing.id, name: recommendationError instanceof Error ? recommendationError.name : "UnknownError" })
    }

    try {
      await generateCrossSellOpportunitiesForClient({
        organizationId,
        clientId: existing.clientId,
        userId,
      })
    } catch (crossSellError) {
      console.warn({ action: "product_cross_sell_failed", productId: existing.id, name: crossSellError instanceof Error ? crossSellError.name : "UnknownError" })
    }

    return ok(product)
  } catch (error) {
    return handleApiError(error)
  }
}
