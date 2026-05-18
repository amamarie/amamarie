import { fail, handleApiError, ok } from "@/lib/api-response"
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
      select: { id: true, advisorId: true },
    })

    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)

    const recommendations = await generateRecommendationsForClient({
      organizationId,
      clientId: id,
      advisorId: client.advisorId ?? userId,
      userId,
    })

    return ok(recommendations)
  } catch (error) {
    return handleApiError(error)
  }
}
