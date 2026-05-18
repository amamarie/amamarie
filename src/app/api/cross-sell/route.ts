import { Prisma } from "@prisma/client"

import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import {
  crossSellCategorySchema,
  crossSellFiltersSchema,
  crossSellPrioritySchema,
  crossSellStatusSchema,
} from "@/lib/validations/cross-sell"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const filters = crossSellFiltersSchema.parse({
      category: crossSellCategorySchema.safeParse(searchParams.get("category")).success ? searchParams.get("category") : undefined,
      priority: crossSellPrioritySchema.safeParse(searchParams.get("priority")).success ? searchParams.get("priority") : undefined,
      status: crossSellStatusSchema.safeParse(searchParams.get("status")).success ? searchParams.get("status") : undefined,
      clientId: searchParams.get("clientId") ?? undefined,
      advisorId: searchParams.get("advisorId") ?? undefined,
    })

    const where: Prisma.CrossSellOpportunityWhereInput = {
      organizationId,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.advisorId ? { advisorId: filters.advisorId } : {}),
    }

    const opportunities = await prisma.crossSellOpportunity.findMany({
      where,
      include: { client: true, advisor: true, relatedProduct: true },
      orderBy: [{ createdAt: "desc" }],
      take: 150,
    })

    return ok(opportunities)
  } catch (error) {
    return handleApiError(error)
  }
}
