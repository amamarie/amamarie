import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { logKycAccess } from "@/lib/compliance/kyc-advanced"
import { canArchiveKyc } from "@/lib/compliance/permissions"
import { createCrmActivity } from "@/lib/crm-events"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    if (!canArchiveKyc(user)) return fail("FORBIDDEN", "Archivage du profil client non autorisé.", 403)
    const { organizationId } = await getTenantContext()
    const body = await request.json().catch(() => ({})) as { reason?: string }
    const reason = body.reason?.trim() || "Archivage du profil client selon politique cabinet."

    const client = await prisma.client.findFirst({
      where: { id, organizationId },
      include: { kycProfile: true },
    })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    if (!client.kycProfile) return fail("NOT_FOUND", "Profil client introuvable.", 404)

    const kyc = await prisma.clientKycProfile.update({
      where: { id: client.kycProfile.id },
      data: {
        status: "ARCHIVED",
        reviewStatus: "ARCHIVED",
        reviewNotes: reason,
      },
    })

    await prisma.kycAlert.updateMany({
      where: { organizationId, clientId: id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      data: { status: "ARCHIVED", resolutionNote: reason, resolvedAt: new Date(), resolvedById: user.id },
    })

    await createAuditLog({
      organizationId,
      userId: user.id,
      clientId: id,
      entityType: "KYC",
      entityId: kyc.id,
      action: "KYC_ARCHIVED",
      newValue: { reason },
    })
    await logKycAccess({
      organizationId,
      clientId: id,
      userId: user.id,
      accessType: "KYC_ARCHIVE",
      purpose: "Archivage formalisé du profil client.",
      sensitiveFields: ["kycProfile", "kycAlerts"],
      masked: true,
      metadata: { reason },
    })
    await createCrmActivity({
      organizationId,
      userId: user.id,
      clientId: id,
      type: "KYC_UPDATED",
      title: "Profil client archivé",
      description: reason,
    })

    return ok(kyc)
  } catch (error) {
    return handleApiError(error)
  }
}
