import { fail, handleApiError, ok } from "@/lib/api-response"
import { logKycAccess } from "@/lib/compliance/kyc-advanced"
import { canExportKyc } from "@/lib/compliance/permissions"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

function maskSinLast4(value?: string | null) {
  return value ? `***${value}` : null
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    if (!canExportKyc(user)) return fail("FORBIDDEN", "Export du profil client non autorisé.", 403)
    const { organizationId } = await getTenantContext()
    const settings = await prisma.kycPolicySettings.findUnique({ where: { organizationId } })
    if (settings && !settings.clientExportEnabled) return fail("EXPORT_DISABLED", "L’export du profil client est désactivé par la politique cabinet.", 403)

    const client = await prisma.client.findFirst({
      where: { id, organizationId },
      include: {
        kycProfile: true,
        investmentProfile: true,
        financialGoalItems: true,
        riskQuestionnaireAnswers: true,
        kycVersions: { orderBy: { versionNumber: "desc" } },
        consents: true,
        documents: { where: { type: { in: ["KYC_FORM", "RISK_PROFILE", "CONSENT_FORM", "GOVERNMENT_ID"] } } },
      },
    })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      client: {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.emailPrimary ?? client.email,
        phone: client.phonePrimary ?? client.phone,
      },
      kycProfile: client.kycProfile ? {
        ...client.kycProfile,
        sinLast4: maskSinLast4(client.kycProfile.sinLast4),
      } : null,
      investmentProfile: client.investmentProfile,
      financialGoals: client.financialGoalItems,
      riskQuestionnaireAnswers: client.riskQuestionnaireAnswers,
      kycVersions: client.kycVersions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        lockedAt: version.lockedAt,
        clientConfirmedAt: version.clientConfirmedAt,
        advisorValidatedAt: version.advisorValidatedAt,
        integrityHash: version.integrityHash,
      })),
      consents: client.consents,
      documents: client.documents.map((document) => ({
        id: document.id,
        name: document.name,
        type: document.type,
        status: document.status,
        receivedAt: document.receivedAt,
        validatedAt: document.validatedAt,
      })),
    }

    await logKycAccess({
      organizationId,
      clientId: id,
      userId: user.id,
      accessType: "KYC_EXPORT",
      purpose: "Export des renseignements de profil client.",
      sensitiveFields: ["identity", "income", "netWorth", "riskProfile", "documents", "consents"],
      masked: true,
      exportFormat: "json",
    })

    return ok(exportPayload)
  } catch (error) {
    return handleApiError(error)
  }
}
