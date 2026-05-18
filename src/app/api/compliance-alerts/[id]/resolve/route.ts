import { fail, handleApiError, ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const existing = await prisma.complianceAlert.findFirst({ where: { id, organizationId } })
    if (!existing) return fail("NOT_FOUND", "Alerte introuvable.", 404)
    await prisma.complianceAlert.updateMany({
      where: { id, organizationId },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: userId },
    })
    const alert = await prisma.complianceAlert.findFirstOrThrow({ where: { id, organizationId } })
    await createCrmActivity({ organizationId, userId, clientId: alert.clientId, type: "COMPLIANCE_ALERT_RESOLVED", title: "Alerte conformité résolue", description: alert.title })
    await createAuditLog({ organizationId, userId, clientId: alert.clientId, entityType: "COMPLIANCE_ALERT", entityId: alert.id, action: "COMPLIANCE_ALERT_RESOLVED", newValue: { status: "RESOLVED" } })
    return ok(alert)
  } catch (error) {
    return handleApiError(error)
  }
}
