import { fail, handleApiError, ok } from "@/lib/api-response"
import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { ensureInsuranceNeedsDeliveredBeforePolicy } from "@/lib/compliance/insurance-delivery"
import { assertKycAllowsOpportunity } from "@/lib/compliance/kyc-opportunity"
import { prisma } from "@/lib/db"
import { ensureReplacementAnalysisForOpportunity } from "@/lib/insurance-needs/service"
import { assertInsuranceOpportunityCanUseAnalysis, syncInsuranceOpportunityAnalysis } from "@/lib/insurance-needs/opportunity-sync"
import { getTenantContext } from "@/lib/tenant"
import { financialProductCreateSchema, financialProductFiltersSchema } from "@/lib/validators"

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

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const url = new URL(request.url)
    const filters = financialProductFiltersSchema.parse(Object.fromEntries(url.searchParams))
    const renewalLimit = filters.renewalSoon
      ? new Date(Date.now() + Number(filters.renewalSoon) * 24 * 60 * 60 * 1000)
      : null

    const products = await prisma.financialProduct.findMany({
      where: {
        organizationId,
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.company ? { company: { contains: filters.company, mode: "insensitive" } } : {}),
        ...(renewalLimit ? { renewalAt: { gte: new Date(), lte: renewalLimit } } : {}),
      },
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
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    })

    return ok(products)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = financialProductCreateSchema.parse(await request.json())
    const client = await prisma.client.findFirstOrThrow({
      where: { id: payload.clientId, organizationId },
      select: { id: true, advisorId: true },
    })
    if (payload.advisorId) {
      const advisor = await prisma.user.findFirst({
        where: { id: payload.advisorId, organizationId },
        select: { id: true },
      })
      if (!advisor) return fail("NOT_FOUND", "Le conseiller assigné est introuvable.", 404)
    }
    if (payload.category === "INSURANCE") {
      await assertInsuranceOpportunityCanUseAnalysis({
        organizationId,
        userId,
        clientId: client.id,
        productType: payload.type,
        targetStatus: payload.status,
      })
    }
    await assertKycAllowsOpportunity({
      organizationId,
      clientId: client.id,
      category: payload.category,
      targetStatus: payload.status,
    })

    const product = await prisma.financialProduct.create({
      data: {
        ...payload,
        organizationId,
        clientId: client.id,
        advisorId: payload.advisorId ?? client.advisorId ?? userId,
      },
    })
    if (product.category === "INSURANCE") {
      await ensureReplacementAnalysisForOpportunity({ organizationId, userId, productId: product.id })
      await assertInsuranceOpportunityCanUseAnalysis({
        organizationId,
        userId,
        clientId: product.clientId,
        productType: product.type,
        opportunityId: product.id,
        targetStatus: product.status,
      })
      await syncInsuranceOpportunityAnalysis({ organizationId, userId, productId: product.id })
    }

    await createCrmActivity({
      organizationId,
      userId,
      clientId: product.clientId,
      type: "PRODUCT_CREATED",
      title: "Produit financier ajouté",
      description: product.policyNumber ?? product.type,
    })

    await runAutomationsForEvent({
      organizationId,
      userId,
      clientId: product.clientId,
      event: "PRODUCT_CREATED",
      entityType: "product",
      entityId: product.id,
      title: "Produit financier ajouté",
      description: product.policyNumber ?? product.type,
      payload: { status: product.status, type: product.type, category: product.category, productId: product.id },
    })

    await ensureInsuranceNeedsDeliveredBeforePolicy({ organizationId, userId, productId: product.id })

    return ok(product, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      const message = insuranceAnalysisGateMessage(error)
      if (message) return fail("INSURANCE_ANALYSIS_BLOCKED", message, 409)
    }
    return handleApiError(error)
  }
}
