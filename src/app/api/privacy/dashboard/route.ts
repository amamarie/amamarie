import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { ensureDefaultPrivacyPurposes } from "@/lib/privacy/service"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId, userId } = await getTenantContext()
    await ensureDefaultPrivacyPurposes(organizationId, userId)
    const now = new Date()
    const [
      expiredConsents,
      missingKycConsents,
      openPrivacyRequests,
      outsideQuebecDisclosures,
      openIncidents,
      retentionReviewDocuments,
      piaDue,
      purposes,
      recentPrivacyRequests,
      recentDisclosures,
      recentIncidents,
      piasToReview,
      expiredConsentItems,
      missingKycConsentClients,
      clientsForConsentReadiness,
      retentionDocuments,
      vendorsToReview,
      vendorsWithoutPia,
      highAccessRiskEvents,
      accessRiskItems,
    ] = await Promise.all([
      prisma.clientConsent.count({ where: { organizationId, status: "GIVEN", expiresAt: { lte: now } } }),
      prisma.client.count({ where: { organizationId, status: { not: "ARCHIVED" }, consents: { none: { status: "GIVEN", OR: [{ purpose: { code: "kyc_use" } }, { type: { contains: "KYC", mode: "insensitive" } }, { type: { contains: "profil", mode: "insensitive" } }] } } } }),
      prisma.privacyRequest.count({ where: { organizationId, status: { notIn: ["CLOSED", "ARCHIVED"] } } }),
      prisma.dataDisclosure.count({ where: { organizationId, outsideQuebec: true } }),
      prisma.privacyIncident.count({ where: { organizationId, status: { notIn: ["CLOSED", "ARCHIVED"] } } }),
      prisma.document.count({ where: { organizationId, deletedAt: null, retentionReviewAt: { lte: now } } }),
      prisma.privacyImpactAssessment.count({ where: { organizationId, OR: [{ status: { not: "APPROVED" }, outsideQuebec: true }, { reviewDueAt: { lte: now } }] } }),
      prisma.privacyPurpose.findMany({ where: { organizationId, active: true }, orderBy: { name: "asc" }, take: 12 }),
      prisma.privacyRequest.findMany({
        where: { organizationId, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        include: { client: { select: { id: true, firstName: true, lastName: true } }, assignedTo: { select: { id: true, name: true } } },
        orderBy: { receivedAt: "desc" },
        take: 6,
      }),
      prisma.dataDisclosure.findMany({
        where: { organizationId },
        include: { client: { select: { id: true, firstName: true, lastName: true } }, purpose: { select: { id: true, name: true, code: true } } },
        orderBy: { disclosedAt: "desc" },
        take: 6,
      }),
      prisma.privacyIncident.findMany({
        where: { organizationId, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        include: { detectedBy: { select: { id: true, name: true, role: true } } },
        orderBy: { detectedAt: "desc" },
        take: 6,
      }),
      prisma.privacyImpactAssessment.findMany({
        where: { organizationId, OR: [{ status: { not: "APPROVED" }, outsideQuebec: true }, { reviewDueAt: { lte: now } }] },
        include: { approvedBy: { select: { id: true, name: true, role: true } } },
        orderBy: [{ reviewDueAt: "asc" }, { updatedAt: "desc" }],
        take: 6,
      }),
      prisma.clientConsent.findMany({
        where: { organizationId, status: "GIVEN", expiresAt: { lte: now } },
        include: { client: { select: { id: true, firstName: true, lastName: true } }, purpose: { select: { id: true, name: true, code: true } } },
        orderBy: { expiresAt: "asc" },
        take: 6,
      }),
      prisma.client.findMany({
        where: { organizationId, status: { not: "ARCHIVED" }, consents: { none: { status: "GIVEN", OR: [{ purpose: { code: "kyc_use" } }, { type: { contains: "KYC", mode: "insensitive" } }, { type: { contains: "profil", mode: "insensitive" } }] } } },
        select: { id: true, firstName: true, lastName: true, advisor: { select: { id: true, name: true } }, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      prisma.client.findMany({
        where: { organizationId, status: { not: "ARCHIVED" } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          updatedAt: true,
          advisor: { select: { id: true, name: true } },
          consents: {
            where: { status: "GIVEN", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
            select: { purpose: { select: { id: true, code: true, name: true, isRequiredForService: true } } },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.document.findMany({
        where: { organizationId, deletedAt: null, retentionReviewAt: { lte: now } },
        include: { client: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { retentionReviewAt: "asc" },
        take: 6,
      }),
      prisma.privacyVendor.count({ where: { organizationId, OR: [{ nextReviewAt: { lte: now } }, { status: { not: "ACTIVE" } }] } }),
      prisma.privacyVendor.count({ where: { organizationId, outsideQuebec: true, OR: [{ piaCompleted: false }, { contractSigned: false }] } }),
      prisma.privacyAccessRiskEvent.count({ where: { organizationId, status: "OPEN", riskLevel: { in: ["HIGH", "CRITICAL"] } } }),
      prisma.privacyAccessRiskEvent.findMany({
        where: { organizationId, status: "OPEN", riskLevel: { in: ["HIGH", "CRITICAL"] } },
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: [{ riskScore: "desc" }, { createdAt: "desc" }],
        take: 6,
      }),
    ])

    const coreConsentPurposeCodes = new Set(["client_profile_collection", "kyc_use", "insurance_needs_analysis", "document_vault"])
    const actionConsentPurposeCodes = new Set(["ai_assistance", "insurer_disclosure"])
    const trackedPurposeCodes = new Set([...coreConsentPurposeCodes, ...actionConsentPurposeCodes])
    const trackedPurposes = purposes.filter((purpose) => trackedPurposeCodes.has(purpose.code))
    const missingPurposeClients = clientsForConsentReadiness
      .map((client) => {
        const activePurposeCodes = new Set(client.consents.map((consent) => consent.purpose?.code).filter(Boolean))
        const missingPurposes = trackedPurposes
          .filter((purpose) => !activePurposeCodes.has(purpose.code))
          .map((purpose) => ({
            id: purpose.id,
            code: purpose.code,
            name: purpose.name,
            isRequiredForService: purpose.isRequiredForService || coreConsentPurposeCodes.has(purpose.code),
          }))
        const missingRequiredCount = missingPurposes.filter((purpose) => purpose.isRequiredForService).length
        const missingActionCount = missingPurposes.filter((purpose) => actionConsentPurposeCodes.has(purpose.code)).length

        return {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          updatedAt: client.updatedAt,
          advisor: client.advisor,
          missingPurposes,
          missingRequiredCount,
          missingActionCount,
        }
      })
      .filter((client) => client.missingPurposes.length > 0)
      .sort((first, second) => {
        if (second.missingRequiredCount !== first.missingRequiredCount) return second.missingRequiredCount - first.missingRequiredCount
        return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
      })

    return ok({
      metrics: {
        expiredConsents,
        missingKycConsents,
        clientsMissingRequiredPurposes: missingPurposeClients.filter((client) => client.missingRequiredCount > 0).length,
        openPrivacyRequests,
        outsideQuebecDisclosures,
        openIncidents,
        retentionReviewDocuments,
        piaDue,
        vendorsToReview,
        vendorsWithoutPia,
        highAccessRiskEvents,
      },
      purposes,
      recentPrivacyRequests,
      recentDisclosures,
      recentIncidents,
      piasToReview,
      expiredConsentItems,
      missingKycConsentClients,
      missingPurposeClients: missingPurposeClients.slice(0, 8),
      retentionDocuments,
      accessRiskItems,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
