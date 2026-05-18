import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const event = await prisma.complianceEvent.findFirst({ where: { id, organizationId } })
    if (!event) return fail("NOT_FOUND", "Événement conformité introuvable.", 404)
    const resolved = await prisma.complianceEvent.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolvedById: userId,
        resolvedAt: new Date(),
        resolutionNote: typeof body.resolutionNote === "string" ? body.resolutionNote : null,
      },
    })
    await createAuditLog({ organizationId, userId, clientId: event.clientId, entityType: "ComplianceEvent", entityId: id, action: "COMPLIANCE_EVENT_RESOLVED", oldValue: { status: event.status }, newValue: { status: resolved.status, resolutionNote: resolved.resolutionNote } })
    return ok(resolved)
  } catch (error) {
    return handleApiError(error)
  }
}
