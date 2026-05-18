import { fail, handleApiError, ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import { dismissComplianceAlertSchema } from "@/lib/validations/compliance-alert"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = dismissComplianceAlertSchema.parse(await request.json())
    const existing = await prisma.complianceAlert.findFirst({ where: { id, organizationId } })
    if (!existing) return fail("NOT_FOUND", "Alerte introuvable.", 404)
    await prisma.complianceAlert.updateMany({
      where: { id, organizationId },
      data: { status: "DISMISSED", dismissedAt: new Date(), dismissedById: userId, dismissReason: payload.dismissReason },
    })
    const alert = await prisma.complianceAlert.findFirstOrThrow({ where: { id, organizationId } })
    await createCrmActivity({ organizationId, userId, clientId: alert.clientId, type: "COMPLIANCE_ALERT_DISMISSED", title: "Alerte conformité ignorée", description: alert.title })
    await createAuditLog({ organizationId, userId, clientId: alert.clientId, entityType: "COMPLIANCE_ALERT", entityId: alert.id, action: "COMPLIANCE_ALERT_DISMISSED", newValue: { status: "DISMISSED", reason: payload.dismissReason } })
    return ok(alert)
  } catch (error) {
    return handleApiError(error)
  }
}
