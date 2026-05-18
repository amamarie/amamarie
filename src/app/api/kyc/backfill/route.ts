import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { syncAdvancedKycArtifacts } from "@/lib/compliance/kyc-advanced"
import { assertCanManageKycPolicy } from "@/lib/compliance/permissions"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function POST() {
  try {
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    assertCanManageKycPolicy(user)
    const { organizationId } = await getTenantContext()
    const profiles = await prisma.clientKycProfile.findMany({
      where: { organizationId, status: { not: "ARCHIVED" } },
      include: { client: { select: { id: true, advisorId: true, organizationId: true } } },
      orderBy: { updatedAt: "desc" },
      take: 500,
    })

    let synced = 0
    const errors: Array<{ kycProfileId: string; message: string }> = []
    for (const profile of profiles) {
      try {
        await syncAdvancedKycArtifacts({
          organizationId,
          clientId: profile.clientId,
          userId: user.id,
          kyc: profile,
        })
        synced += 1
      } catch (error) {
        errors.push({
          kycProfileId: profile.id,
          message: error instanceof Error ? error.message : "Erreur inconnue",
        })
      }
    }

    await createAuditLog({
      organizationId,
      userId: user.id,
      entityType: "KYC",
      entityId: organizationId,
      action: "KYC_ADVANCED_BACKFILL",
      newValue: { scanned: profiles.length, synced, errors },
    })

    return ok({ scanned: profiles.length, synced, errors })
  } catch (error) {
    return handleApiError(error)
  }
}
