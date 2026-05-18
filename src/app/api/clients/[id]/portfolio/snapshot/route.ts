import { fail, handleApiError, ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { generateCrossSellOpportunitiesForClient } from "@/lib/cross-sell/engine"
import { calculatePortfolioSummary } from "@/lib/portfolio/calculations"
import { prisma } from "@/lib/prisma"
import { generateRecommendationsForClient } from "@/lib/recommendations/engine"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const client = await prisma.client.findFirst({
      where: { id, organizationId },
      include: { products: { where: { organizationId } } },
    })

    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)

    const summary = calculatePortfolioSummary(client.products)
    const snapshot = await prisma.portfolioSnapshot.create({
      data: {
        organizationId,
        clientId: client.id,
        totalInvestmentValue: summary.totalInvestmentValue,
        totalInsuranceCoverage: summary.totalInsuranceCoverage,
        totalAnnualPremium: summary.totalAnnualPremium,
        totalMonthlyContribution: summary.totalMonthlyContribution,
        totalEstimatedCommission: summary.totalEstimatedCommission,
      },
    })

    await createCrmActivity({
      organizationId,
      userId,
      clientId: client.id,
      type: "CLIENT_UPDATED",
      title: "Snapshot portefeuille créé",
      description: `${client.firstName} ${client.lastName}`,
    })

    try {
      await generateRecommendationsForClient({
        organizationId,
        clientId: client.id,
        advisorId: client.advisorId,
        userId,
      })
    } catch (recommendationError) {
      console.warn({ action: "portfolio_recommendations_failed", clientId: client.id, name: recommendationError instanceof Error ? recommendationError.name : "UnknownError" })
    }

    try {
      await generateCrossSellOpportunitiesForClient({
        organizationId,
        clientId: client.id,
        advisorId: client.advisorId,
        userId,
      })
    } catch (crossSellError) {
      console.warn({ action: "portfolio_cross_sell_failed", clientId: client.id, name: crossSellError instanceof Error ? crossSellError.name : "UnknownError" })
    }

    return ok(snapshot, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
