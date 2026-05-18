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
    const event = await prisma.amlMonitoringEvent.findFirst({ where: { id, organizationId } })
    if (!event) return fail("NOT_FOUND", "Événement AML introuvable.", 404)
    const updated = await prisma.amlMonitoringEvent.update({
      where: { id },
      data: {
        status: "RESOLVED",
        reviewedById: userId,
        reviewedAt: new Date(),
        resolutionNote: typeof body.resolutionNote === "string" ? body.resolutionNote : "Événement revu par conformité.",
      },
    })
    await createAuditLog({
      organizationId,
      userId,
      clientId: event.clientId,
      entityType: "AmlMonitoringEvent",
      entityId: event.id,
      action: "AML_MONITORING_EVENT_RESOLVED",
      oldValue: { status: event.status },
      newValue: { status: updated.status, resolutionNote: updated.resolutionNote },
      sensitivityLevel: "HIGH",
      request,
    })
    await recalculateAmlRisk({ organizationId, clientId: event.clientId, userId, request })
    return ok({ event: updated })
  } catch (error) {
    return handleApiError(error)
  }
}
