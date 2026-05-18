import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const existing = await prisma.privacyImpactAssessment.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!existing) return fail("NOT_FOUND", "EFVP introuvable.", 404)
    const pia = await prisma.privacyImpactAssessment.update({
      where: { id },
      data: {
        status: typeof body.status === "string" ? body.status : undefined,
        riskSummary: typeof body.riskSummary === "string" ? body.riskSummary : undefined,
        mitigationMeasures: typeof body.mitigationMeasures === "string" ? body.mitigationMeasures : undefined,
        approvedById: body.status === "APPROVED" ? userId : undefined,
        approvedAt: body.status === "APPROVED" ? new Date() : undefined,
        reviewDueAt: body.reviewDueAt ? new Date(body.reviewDueAt) : undefined,
      },
    })
    await createAuditLog({ organizationId, userId, entityType: "PrivacyImpactAssessment", entityId: id, action: "PIA_UPDATED", newValue: { status: pia.status } })
    return ok(pia)
  } catch (error) {
    return handleApiError(error)
  }
}
