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
    const action = typeof body.action === "string" ? body.action.toUpperCase() : ""
    const decisionNote = typeof body.decisionNote === "string" ? body.decisionNote.trim() : null
    if (!["APPROVE", "REJECT"].includes(action)) return fail("VALIDATION_ERROR", "Action invalide.", 422)

    const current = await prisma.complianceApprovalStep.findFirst({ where: { id, organizationId } })
    if (!current) return fail("NOT_FOUND", "Étape d’approbation introuvable.", 404)
    if (current.status !== "PENDING") return fail("VALIDATION_ERROR", "Cette étape n’est plus en attente.", 422)

    if (action === "APPROVE") {
      const lowerPending = await prisma.complianceApprovalStep.findFirst({
        where: {
          organizationId,
          linkedEntityType: current.linkedEntityType,
          linkedEntityId: current.linkedEntityId,
          status: "PENDING",
          level: { lt: current.level },
        },
        orderBy: { level: "asc" },
      })
      if (lowerPending) {
        return fail("APPROVAL_SEQUENCE_REQUIRED", "Les niveaux inférieurs doivent être approuvés avant celui-ci.", 409)
      }
    }

    const updated = await prisma.complianceApprovalStep.update({
      where: { id },
      data: action === "APPROVE"
        ? { status: "APPROVED", approverId: userId, approvedAt: new Date(), decisionNote }
        : { status: "REJECTED", approverId: userId, rejectedAt: new Date(), decisionNote },
    })

    await createComplianceEvent({
      organizationId,
      userId,
      clientId: current.clientId,
      eventCategory: "APPROVAL",
      eventTitle: action === "APPROVE" ? `Approbation niveau ${current.level} acceptée` : `Approbation niveau ${current.level} refusée`,
      description: decisionNote ?? `Étape ${current.title}`,
      severity: action === "APPROVE" ? "INFO" : "CRITICAL",
      linkedEntityType: current.linkedEntityType,
      linkedEntityId: current.linkedEntityId,
    })

    await createAuditLog({
      organizationId,
      userId,
      clientId: current.clientId,
      entityType: "ComplianceApprovalStep",
      entityId: current.id,
      action: action === "APPROVE" ? "COMPLIANCE_APPROVAL_STEP_APPROVED" : "COMPLIANCE_APPROVAL_STEP_REJECTED",
      oldValue: { status: current.status },
      newValue: { status: updated.status, level: updated.level, linkedEntityType: updated.linkedEntityType, linkedEntityId: updated.linkedEntityId },
      source: "api",
      sensitivityLevel: "HIGH",
      reason: decisionNote,
      request,
    })

    return ok(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
