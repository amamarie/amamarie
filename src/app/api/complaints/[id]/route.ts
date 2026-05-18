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
    const current = await prisma.complaint.findFirst({ where: { id, organizationId } })
    if (!current) return fail("NOT_FOUND", "Plainte introuvable.", 404)
    const action = typeof body.action === "string" ? body.action.toUpperCase() : ""
    const now = new Date()
    const statusFromAction = action === "ACKNOWLEDGE"
      ? "IN_REVIEW"
      : action === "ESCALATE"
        ? "ESCALATED"
        : action === "CLOSE"
          ? "CLOSED"
          : action === "REOPEN"
            ? "OPEN"
            : undefined
    const resolutionSummary = typeof body.resolutionSummary === "string" ? body.resolutionSummary : undefined
    const next = await prisma.complaint.update({
      where: { id },
      data: {
        status: statusFromAction ?? (typeof body.status === "string" ? body.status : undefined),
        acknowledgedAt: action === "ACKNOWLEDGE" ? now : body.acknowledgedAt ? new Date(body.acknowledgedAt) : undefined,
        resolutionSummary,
        closedAt: action === "CLOSE" ? now : action === "REOPEN" ? null : body.closedAt ? new Date(body.closedAt) : body.status === "CLOSED" ? now : undefined,
        reportableToAmf: typeof body.reportableToAmf === "boolean" ? body.reportableToAmf : undefined,
      },
    })
    await createComplianceEvent({
      organizationId,
      userId,
      clientId: current.clientId,
      eventCategory: "COMPLAINT",
      eventTitle: action ? `Plainte ${action}` : "Plainte mise à jour",
      description: resolutionSummary ?? next.description,
      severity: next.severity,
      assignedToId: next.assignedToId,
      linkedEntityType: "Complaint",
      linkedEntityId: next.id,
    })
    await createAuditLog({
      organizationId,
      userId,
      clientId: current.clientId,
      entityType: "Complaint",
      entityId: id,
      action: action ? `COMPLAINT_${action}` : "COMPLAINT_UPDATED",
      oldValue: { status: current.status, acknowledgedAt: current.acknowledgedAt, closedAt: current.closedAt, reportableToAmf: current.reportableToAmf },
      newValue: { status: next.status, acknowledgedAt: next.acknowledgedAt, closedAt: next.closedAt, reportableToAmf: next.reportableToAmf },
      source: "api",
      sensitivityLevel: next.severity === "HIGH" || next.severity === "CRITICAL" ? "HIGH" : "MEDIUM",
      reason: resolutionSummary ?? null,
      request,
    })
    return ok(next)
  } catch (error) {
    return handleApiError(error)
  }
}
