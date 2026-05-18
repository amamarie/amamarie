import { fail, handleApiError, ok } from "@/lib/api-response"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { createCrmActivity } from "@/lib/crm-events"
import { createAuditLog } from "@/lib/compliance/audit"
import { syncKycOpportunityPipeline } from "@/lib/compliance/kyc-opportunity"
import { assertCanApproveKyc } from "@/lib/compliance/permissions"
import { createKycSnapshot } from "@/lib/compliance/snapshots"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    assertCanApproveKyc(user)
    const { organizationId } = await getTenantContext()
    const existing = await prisma.clientKycProfile.findFirst({ where: { clientId: id, organizationId } })
    if (!existing) return fail("NOT_FOUND", "Profil client introuvable.", 404)

    await prisma.clientKycProfile.updateMany({
      where: { id: existing.id, organizationId },
      data: { status: "APPROVED", approvedById: user.id, approvedAt: new Date(), rejectedAt: null, rejectedReason: null },
    })
    const kyc = await prisma.clientKycProfile.findFirstOrThrow({ where: { id: existing.id, organizationId } })
    await createCrmActivity({ organizationId, userId: user.id, clientId: id, type: "KYC_APPROVED", title: "Profil client approuvé", description: "Le profil client a été approuvé." })
    await createAuditLog({ organizationId, userId: user.id, clientId: id, entityType: "KYC", entityId: kyc.id, action: "KYC_APPROVED", newValue: { status: "APPROVED" } })
    await syncKycOpportunityPipeline({ organizationId, clientId: id, userId: user.id })
    await createKycSnapshot({
      organizationId,
      clientId: id,
      userId: user.id,
      reason: "COMPLIANCE_REVIEW",
      advisorAttestationAccepted: true,
      clientAccuracyConfirmed: true,
      useForAnalysisOrRecommendation: true,
    })
    return ok(kyc)
  } catch (error) {
    return handleApiError(error)
  }
}
