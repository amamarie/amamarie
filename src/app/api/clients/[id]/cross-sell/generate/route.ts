import { fail, handleApiError, ok } from "@/lib/api-response"
import { generateCrossSellOpportunitiesForClient } from "@/lib/cross-sell/engine"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const client = await prisma.client.findFirst({
      where: { id, organizationId },
      select: { id: true, advisorId: true },
    })

    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)

    const opportunities = await generateCrossSellOpportunitiesForClient({
      organizationId,
      clientId: id,
      advisorId: client.advisorId ?? userId,
      userId,
    })

    return ok(opportunities)
  } catch (error) {
    return handleApiError(error)
  }
}
