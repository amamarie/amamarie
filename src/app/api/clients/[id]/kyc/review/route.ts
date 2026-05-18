import { fail, handleApiError, ok } from "@/lib/api-response"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { createCrmActivity } from "@/lib/crm-events"
import { createAuditLog } from "@/lib/compliance/audit"
import { syncKycOpportunityPipeline } from "@/lib/compliance/kyc-opportunity"
import { createKycSnapshot } from "@/lib/compliance/snapshots"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import { reviewKycSchema } from "@/lib/validations/kyc"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    const { organizationId } = await getTenantContext()
    const payload = reviewKycSchema.parse(await request.json().catch(() => ({})))
    const existing = await prisma.clientKycProfile.findFirst({ where: { clientId: id, organizationId } })
    if (!existing) return fail("NOT_FOUND", "Profil client introuvable.", 404)

    const nextReview = new Date()
    nextReview.setFullYear(nextReview.getFullYear() + 1)
    await prisma.clientKycProfile.updateMany({
      where: { id: existing.id, organizationId },
      data: {
        status: payload.changesDetected ? "NEEDS_UPDATE" : "PENDING_REVIEW",
        lastKycReviewAt: new Date(),
        nextKycReviewAt: nextReview,
        reviewedById: user.id,
        reviewStatus: "COMPLETED",
        reviewNotes: payload.reviewNotes,
        changesDetected: payload.changesDetected ?? false,
        clientConfirmedNoChange: payload.clientConfirmedNoChange ?? false,
        advisorAttestation: payload.advisorAttestation ?? false,
        advisorAttestationAt: payload.advisorAttestation ? new Date() : null,
      },
    })
    const kyc = await prisma.clientKycProfile.findFirstOrThrow({ where: { id: existing.id, organizationId } })
    await createCrmActivity({ organizationId, userId: user.id, clientId: id, type: "KYC_REVIEW_COMPLETED", title: "Révision du profil client complétée", description: payload.reviewNotes })
    await createAuditLog({ organizationId, userId: user.id, clientId: id, entityType: "KYC", entityId: kyc.id, action: "KYC_REVIEW_COMPLETED", newValue: { nextKycReviewAt: nextReview.toISOString() } })
    await syncKycOpportunityPipeline({ organizationId, clientId: id, userId: user.id })
    await createKycSnapshot({
      organizationId,
      clientId: id,
      userId: user.id,
      reason: "ANNUAL_REVIEW",
      advisorAttestationAccepted: Boolean(payload.advisorAttestation),
      clientAccuracyConfirmed: Boolean(payload.clientConfirmedNoChange),
      useForAnalysisOrRecommendation: true,
    })
    return ok(kyc)
  } catch (error) {
    return handleApiError(error)
  }
}
