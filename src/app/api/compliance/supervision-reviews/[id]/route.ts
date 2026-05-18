import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { createComplianceEvent } from "@/lib/compliance/center"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

const ACTION_TO_STATUS: Record<string, string> = {
  APPROVE: "APPROVED",
  REQUEST_CORRECTION: "CORRECTION_REQUIRED",
  CLOSE: "CLOSED",
  REOPEN: "OPEN",
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const action = typeof body.action === "string" ? body.action.toUpperCase() : ""
    const status = ACTION_TO_STATUS[action]
    if (!status) return fail("VALIDATION_ERROR", "Action de supervision invalide.", 422)

    const current = await prisma.supervisionReview.findFirst({ where: { id, organizationId } })
    if (!current) return fail("NOT_FOUND", "Revue de supervision introuvable.", 404)

    const decisionNote = typeof body.decisionNote === "string" ? body.decisionNote.trim() : ""
    const findings = typeof body.findings === "string" ? body.findings.trim() : current.findings
    const requiredCorrections = typeof body.requiredCorrections === "string" ? body.requiredCorrections.trim() : current.requiredCorrections
    const now = new Date()

    const review = await prisma.supervisionReview.update({
      where: { id },
      data: {
        status,
        reviewerId: current.reviewerId ?? userId,
        findings: findings || null,
        requiredCorrections: action === "REQUEST_CORRECTION" ? (requiredCorrections || decisionNote || "Correction requise par la supervision.") : requiredCorrections || null,
        approvedAt: action === "APPROVE" ? now : current.approvedAt,
        closedAt: action === "CLOSE" ? now : action === "REOPEN" ? null : current.closedAt,
      },
    })

    await createComplianceEvent({
      organizationId,
      userId,
      clientId: current.clientId,
      eventCategory: "SUPERVISION",
      eventTitle: `Revue supervision ${status}`,
      description: decisionNote || review.requiredCorrections || review.findings,
      severity: action === "REQUEST_CORRECTION" ? "IMPORTANT" : review.riskLevel,
      assignedToId: review.reviewerId,
      linkedEntityType: "SupervisionReview",
      linkedEntityId: review.id,
    })

    await createAuditLog({
      organizationId,
      userId,
      clientId: current.clientId,
      entityType: "SupervisionReview",
      entityId: review.id,
      action: `SUPERVISION_REVIEW_${status}`,
      oldValue: { status: current.status, findings: current.findings, requiredCorrections: current.requiredCorrections },
      newValue: { status: review.status, findings: review.findings, requiredCorrections: review.requiredCorrections },
      source: "api",
      sensitivityLevel: "HIGH",
      reason: decisionNote || null,
      request,
    })

    return ok(review)
  } catch (error) {
    return handleApiError(error)
  }
}
