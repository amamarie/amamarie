import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { getAmlProfileDetail, recalculateAmlRisk } from "@/lib/aml/service"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const client = await prisma.client.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    const profile = await getAmlProfileDetail({ organizationId, clientId: id })
    return ok({ profile })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const profile = await prisma.amlProfile.findFirst({ where: { organizationId, clientId: id } })
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
      clientId: id,
      entityType: "AmlProfile",
      entityId: updated.id,
      action: "AML_PROFILE_UPDATED",
      oldValue: { notes: profile.notes, assignedComplianceUserId: profile.assignedComplianceUserId },
      newValue: { notes: updated.notes, assignedComplianceUserId: updated.assignedComplianceUserId },
      source: "advisor",
      sensitivityLevel: "HIGH",
      request,
    })

    const recalculated = await recalculateAmlRisk({ organizationId, clientId: id, userId, request })
    return ok({ profile: recalculated })
  } catch (error) {
    return handleApiError(error)
  }
}
