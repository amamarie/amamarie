import { fail, handleApiError, ok } from "@/lib/api-response"
import {
  calculateAssetAllocation,
  calculatePortfolioHealthScore,
  calculatePortfolioSummary,
  calculateProductsNeedingReview,
  calculateUpcomingRenewals,
} from "@/lib/portfolio/calculations"
import { getPortfolioAlerts } from "@/lib/portfolio/alerts"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const client = await prisma.client.findFirst({
      where: { id, organizationId },
      include: {
        products: {
          where: { organizationId },
          include: {
            valueHistory: {
              orderBy: { valueDate: "desc" },
              take: 12,
            },
          },
          orderBy: { updatedAt: "desc" },
        },
        documents: { where: { organizationId }, orderBy: { createdAt: "desc" } },
        tasks: { where: { organizationId }, orderBy: { dueDate: "asc" } },
        portfolioSnapshots: {
          where: { organizationId },
          orderBy: { snapshotDate: "asc" },
          take: 24,
        },
      },
    })

    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)

    const products = client.products
    const summary = calculatePortfolioSummary(products)
    const alerts = getPortfolioAlerts(client, products, client.documents, client.tasks)
    const healthScore = calculatePortfolioHealthScore(
      client,
      products,
      client.documents,
      client.tasks
    )

    return ok({
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
      },
      summary,
      healthScore,
      alerts,
      products,
      insurances: products.filter((product) => product.category === "INSURANCE"),
      investments: products.filter((product) => product.category === "INVESTMENT"),
      assetAllocation: calculateAssetAllocation(products),
      upcomingRenewals: calculateUpcomingRenewals(products, 90),
      productsNeedingReview: calculateProductsNeedingReview(products),
      documents: client.documents,
      tasks: client.tasks,
      snapshots: client.portfolioSnapshots,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
