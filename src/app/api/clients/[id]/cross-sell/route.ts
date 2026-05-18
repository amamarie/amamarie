import { Prisma } from "@prisma/client"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import {
  crossSellCategorySchema,
  crossSellFiltersSchema,
  crossSellPrioritySchema,
  crossSellStatusSchema,
} from "@/lib/validations/cross-sell"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const filters = crossSellFiltersSchema.parse({
      category: crossSellCategorySchema.safeParse(searchParams.get("category")).success ? searchParams.get("category") : undefined,
      priority: crossSellPrioritySchema.safeParse(searchParams.get("priority")).success ? searchParams.get("priority") : undefined,
      status: crossSellStatusSchema.safeParse(searchParams.get("status")).success ? searchParams.get("status") : undefined,
    })

    const client = await prisma.client.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)

    const where: Prisma.CrossSellOpportunityWhereInput = {
      organizationId,
      clientId: id,
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    }

    const opportunities = await prisma.crossSellOpportunity.findMany({
      where,
      include: { client: true, advisor: true, relatedProduct: true },
      orderBy: [{ createdAt: "desc" }],
    })

    return ok(opportunities)
  } catch (error) {
    return handleApiError(error)
  }
}
