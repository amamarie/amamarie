import { fail, handleApiError, ok } from "@/lib/api-response"
import { generateComplianceAlertsForClient } from "@/lib/compliance/generate"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const client = await prisma.client.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    return ok(await generateComplianceAlertsForClient({ organizationId, clientId: id, userId }))
  } catch (error) {
    return handleApiError(error)
  }
}
