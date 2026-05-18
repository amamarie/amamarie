import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const incident = await prisma.privacyIncident.findFirst({ where: { id, organizationId }, include: { detectedBy: { select: { id: true, name: true, role: true } } } })
    if (!incident) return fail("NOT_FOUND", "Incident introuvable.", 404)
    return ok(incident)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const existing = await prisma.privacyIncident.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!existing) return fail("NOT_FOUND", "Incident introuvable.", 404)
    const incident = await prisma.privacyIncident.update({
      where: { id },
      data: {
        status: typeof body.status === "string" ? body.status : undefined,
        riskLevel: typeof body.riskLevel === "string" ? body.riskLevel : undefined,
        seriousHarmRisk: typeof body.seriousHarmRisk === "boolean" ? body.seriousHarmRisk : undefined,
        mitigationSteps: typeof body.mitigationSteps === "string" ? body.mitigationSteps : undefined,
        rootCause: typeof body.rootCause === "string" ? body.rootCause : undefined,
        correctiveActions: typeof body.correctiveActions === "string" ? body.correctiveActions : undefined,
        notifiedCaiAt: body.notifiedCaiAt ? new Date(body.notifiedCaiAt) : undefined,
        notifiedClientsAt: body.notifiedClientsAt ? new Date(body.notifiedClientsAt) : undefined,
        closedAt: body.status === "CLOSED" ? new Date() : undefined,
      },
    })
    await createAuditLog({ organizationId, userId, entityType: "PrivacyIncident", entityId: id, action: "PRIVACY_INCIDENT_UPDATED", newValue: { status: incident.status, riskLevel: incident.riskLevel } })
    return ok(incident)
  } catch (error) {
    return handleApiError(error)
  }
}
