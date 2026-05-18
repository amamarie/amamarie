import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { createComplianceEvent } from "@/lib/compliance/center"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const current = await prisma.complianceIncident.findFirst({ where: { id, organizationId } })
    if (!current) return fail("NOT_FOUND", "Incident introuvable.", 404)
    const action = typeof body.action === "string" ? body.action.toUpperCase() : ""
    const now = new Date()
    const statusFromAction = action === "ASSESS"
      ? "IN_REVIEW"
      : action === "NOTIFY_AUTHORITY"
        ? "NOTIFICATION_REQUIRED"
        : action === "NOTIFY_CLIENTS"
          ? "NOTIFICATION_REQUIRED"
          : action === "MITIGATE"
            ? "MITIGATING"
            : action === "CLOSE"
              ? "CLOSED"
              : action === "REOPEN"
                ? "OPEN"
                : undefined
    const next = await prisma.complianceIncident.update({
      where: { id },
      data: {
        status: statusFromAction ?? (typeof body.status === "string" ? body.status : undefined),
        riskLevel: typeof body.riskLevel === "string" ? body.riskLevel : undefined,
        seriousHarmRisk: typeof body.seriousHarmRisk === "boolean" ? body.seriousHarmRisk : undefined,
        mitigationSteps: typeof body.mitigationSteps === "string" ? body.mitigationSteps : undefined,
        correctiveActions: typeof body.correctiveActions === "string" ? body.correctiveActions : undefined,
        notifiedAuthorityAt: action === "NOTIFY_AUTHORITY" ? now : body.notifiedAuthorityAt ? new Date(body.notifiedAuthorityAt) : undefined,
        notifiedClientsAt: action === "NOTIFY_CLIENTS" ? now : body.notifiedClientsAt ? new Date(body.notifiedClientsAt) : undefined,
        closedAt: action === "CLOSE" ? now : action === "REOPEN" ? null : body.closedAt ? new Date(body.closedAt) : body.status === "CLOSED" ? now : undefined,
      },
    })
    await createComplianceEvent({
      organizationId,
      userId,
      clientId: current.clientId,
      eventCategory: "INCIDENT",
      eventTitle: action ? `Incident ${action}` : "Incident mis à jour",
      description: next.correctiveActions ?? next.mitigationSteps ?? next.description,
      severity: next.seriousHarmRisk || next.riskLevel === "HIGH" || next.riskLevel === "CRITICAL" ? "CRITICAL" : "IMPORTANT",
      assignedToId: next.assignedToId,
      linkedEntityType: "ComplianceIncident",
      linkedEntityId: next.id,
    })
    await createAuditLog({
      organizationId,
      userId,
      clientId: current.clientId,
      entityType: "ComplianceIncident",
      entityId: id,
      action: action ? `COMPLIANCE_INCIDENT_${action}` : "COMPLIANCE_INCIDENT_UPDATED",
      oldValue: { status: current.status, riskLevel: current.riskLevel, seriousHarmRisk: current.seriousHarmRisk, notifiedAuthorityAt: current.notifiedAuthorityAt, notifiedClientsAt: current.notifiedClientsAt },
      newValue: { status: next.status, riskLevel: next.riskLevel, seriousHarmRisk: next.seriousHarmRisk, notifiedAuthorityAt: next.notifiedAuthorityAt, notifiedClientsAt: next.notifiedClientsAt },
      source: "api",
      sensitivityLevel: "HIGH",
      reason: typeof body.reason === "string" ? body.reason : null,
      request,
    })
    return ok(next)
  } catch (error) {
    return handleApiError(error)
  }
}
