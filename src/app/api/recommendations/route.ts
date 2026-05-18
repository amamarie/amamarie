import { Prisma } from "@prisma/client"

import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import {
  recommendationFiltersSchema,
  recommendationPrioritySchema,
  recommendationStatusSchema,
  recommendationTypeSchema,
} from "@/lib/validations/recommendation"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const filters = recommendationFiltersSchema.parse({
      status: recommendationStatusSchema.safeParse(searchParams.get("status")).success
        ? searchParams.get("status")
        : undefined,
      priority: recommendationPrioritySchema.safeParse(searchParams.get("priority")).success
        ? searchParams.get("priority")
        : undefined,
      type: recommendationTypeSchema.safeParse(searchParams.get("type")).success
        ? searchParams.get("type")
        : undefined,
      clientId: searchParams.get("clientId") ?? undefined,
      advisorId: searchParams.get("advisorId") ?? undefined,
    })

    const where: Prisma.ProductRecommendationWhereInput = {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.advisorId ? { advisorId: filters.advisorId } : {}),
    }

    const recommendations = await prisma.productRecommendation.findMany({
      where,
      include: {
        client: true,
        advisor: true,
        relatedProduct: true,
      },
      orderBy: [{ createdAt: "desc" }],
      take: 150,
    })

    return ok(recommendations)
  } catch (error) {
    return handleApiError(error)
  }
}
