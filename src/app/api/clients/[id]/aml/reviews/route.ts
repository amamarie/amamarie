import { handleApiError, ok } from "@/lib/api-response"
import { ensureAmlProfile, recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const reviews = await prisma.amlReview.findMany({
      where: { organizationId, clientId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
    return ok({ reviews })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const profile = await ensureAmlProfile({ organizationId, clientId: id, userId, request })
    const review = await prisma.amlReview.create({
      data: {
        organizationId,
        clientId: id,
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
      clientId: id,
      entityType: "AmlReview",
      entityId: review.id,
      action: "AML_REVIEW_CREATED",
      newValue: { reviewType: review.reviewType, decision: review.decision, riskLevelAfter: review.riskLevelAfter },
      source: "advisor",
      sensitivityLevel: "HIGH",
      request,
    })
    const recalculated = await recalculateAmlRisk({ organizationId, clientId: id, userId, request })
    return ok({ review, profile: recalculated })
  } catch (error) {
    return handleApiError(error)
  }
}
