import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { generatePriorityItemsForClient } from "@/lib/prioritization/engine"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const client = await prisma.client.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    return ok(await generatePriorityItemsForClient({ organizationId, clientId: id, triggeredById: userId }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
