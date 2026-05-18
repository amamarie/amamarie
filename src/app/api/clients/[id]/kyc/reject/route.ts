import { fail, handleApiError, ok } from "@/lib/api-response"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { createCrmActivity } from "@/lib/crm-events"
import { createAuditLog } from "@/lib/compliance/audit"
import { assertCanApproveKyc } from "@/lib/compliance/permissions"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import { rejectKycSchema } from "@/lib/validations/kyc"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    assertCanApproveKyc(user)
    const { organizationId } = await getTenantContext()
    const payload = rejectKycSchema.parse(await request.json())
    const existing = await prisma.clientKycProfile.findFirst({ where: { clientId: id, organizationId } })
    if (!existing) return fail("NOT_FOUND", "Profil client introuvable.", 404)

    await prisma.clientKycProfile.updateMany({
      where: { id: existing.id, organizationId },
      data: { status: "REJECTED", rejectedById: user.id, rejectedAt: new Date(), rejectedReason: payload.rejectedReason },
    })
    const kyc = await prisma.clientKycProfile.findFirstOrThrow({ where: { id: existing.id, organizationId } })
    await createCrmActivity({ organizationId, userId: user.id, clientId: id, type: "KYC_REJECTED", title: "Profil client rejeté", description: payload.rejectedReason })
    await createAuditLog({ organizationId, userId: user.id, clientId: id, entityType: "KYC", entityId: kyc.id, action: "KYC_REJECTED", newValue: { status: "REJECTED" } })
    return ok(kyc)
  } catch (error) {
    return handleApiError(error)
  }
}
