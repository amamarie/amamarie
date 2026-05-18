import { fail, handleApiError, ok } from "@/lib/api-response"
import { recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const alert = await prisma.amlAlert.findFirst({ where: { id, organizationId } })
    if (!alert) return fail("NOT_FOUND", "Alerte AML introuvable.", 404)

    const updated = await prisma.amlAlert.update({
      where: { id },
      data: {
        status: "RESOLVED",
        resolutionNote: typeof body.resolutionNote === "string" ? body.resolutionNote : "Résolue par conformité.",
        resolvedById: userId,
        resolvedAt: new Date(),
      },
    })
    await createAuditLog({
      organizationId,
      userId,
      clientId: alert.clientId,
      entityType: "AmlAlert",
      entityId: alert.id,
      action: "AML_ALERT_RESOLVED",
      oldValue: { status: alert.status },
      newValue: { status: updated.status, resolutionNote: updated.resolutionNote },
      source: "advisor",
      sensitivityLevel: "HIGH",
      request,
    })
    const profile = await recalculateAmlRisk({ organizationId, clientId: alert.clientId, userId, request })
    return ok({ alert: updated, profile })
  } catch (error) {
    return handleApiError(error)
  }
}
