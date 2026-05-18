import { fail, handleApiError, ok } from "@/lib/api-response"
import { recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ amlProfileId: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { amlProfileId } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const profile = await prisma.amlProfile.findFirst({ where: { id: amlProfileId, organizationId } })
    if (!profile) return fail("NOT_FOUND", "Profil AML introuvable.", 404)
    const review = await prisma.amlReview.create({
      data: {
        organizationId,
        clientId: profile.clientId,
        amlProfileId: profile.id,
        reviewType: typeof body.reviewType === "string" ? body.reviewType : "COMPLIANCE_REVIEW",
        reason: typeof body.reason === "string" ? body.reason : "Revue AML conformité.",
        riskLevelBefore: profile.riskLevel,
        riskLevelAfter: typeof body.riskLevelAfter === "string" ? body.riskLevelAfter : profile.riskLevel,
        decision: typeof body.decision === "string" ? body.decision : "APPROVED",
        reviewedById: userId,
        reviewedAt: new Date(),
        notes: typeof body.notes === "string" ? body.notes : null,
      },
    })
    await createAuditLog({
      organizationId,
      userId,
      clientId: profile.clientId,
      entityType: "AmlReview",
      entityId: review.id,
      action: "AML_REVIEW_CREATED",
      newValue: { reviewType: review.reviewType, decision: review.decision },
      sensitivityLevel: "HIGH",
      request,
    })
    const recalculated = await recalculateAmlRisk({ organizationId, clientId: profile.clientId, userId, request })
    return ok({ review, profile: recalculated })
  } catch (error) {
    return handleApiError(error)
  }
}
