import { fail, handleApiError, ok } from "@/lib/api-response"
import { recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ amlProfileId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { amlProfileId } = await params
    const { organizationId } = await getTenantContext()
    const profile = await prisma.amlProfile.findFirst({
      where: { id: amlProfileId, organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        alerts: { where: { status: { notIn: ["RESOLVED", "CLOSED", "ARCHIVED"] } }, orderBy: { createdAt: "desc" } },
        scoreComponents: { orderBy: { createdAt: "asc" } },
      },
    })
    if (!profile) return fail("NOT_FOUND", "Profil AML introuvable.", 404)
    return ok({ profile })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { amlProfileId } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const profile = await prisma.amlProfile.findFirst({ where: { id: amlProfileId, organizationId } })
    if (!profile) return fail("NOT_FOUND", "Profil AML introuvable.", 404)
    const updated = await prisma.amlProfile.update({
      where: { id: profile.id },
      data: {
        notes: typeof body.notes === "string" ? body.notes : profile.notes,
        assignedComplianceUserId: typeof body.assignedComplianceUserId === "string" ? body.assignedComplianceUserId : profile.assignedComplianceUserId,
        lastReviewedAt: body.markReviewed ? new Date() : profile.lastReviewedAt,
      },
    })
    await createAuditLog({
      organizationId,
      userId,
      clientId: profile.clientId,
      entityType: "AmlProfile",
      entityId: profile.id,
      action: "AML_PROFILE_PATCHED",
      oldValue: { notes: profile.notes, assignedComplianceUserId: profile.assignedComplianceUserId },
      newValue: { notes: updated.notes, assignedComplianceUserId: updated.assignedComplianceUserId },
      sensitivityLevel: "HIGH",
      request,
    })
    const recalculated = await recalculateAmlRisk({ organizationId, clientId: profile.clientId, userId, request })
    return ok({ profile: recalculated })
  } catch (error) {
    return handleApiError(error)
  }
}
