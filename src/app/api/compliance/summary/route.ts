import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    const [
      totalClients,
      incompleteKyc,
      approvedKyc,
      expiredKyc,
      reviewsDue,
      missingDocuments,
      revokedConsents,
      criticalAlerts,
      openAlerts,
      averageScore,
    ] = await Promise.all([
      prisma.client.count({ where: { organizationId } }),
      prisma.clientKycProfile.count({ where: { organizationId, status: { in: ["NOT_STARTED", "IN_PROGRESS", "NEEDS_UPDATE", "REJECTED"] } } }),
      prisma.clientKycProfile.count({ where: { organizationId, status: "APPROVED" } }),
      prisma.clientKycProfile.count({ where: { organizationId, status: "EXPIRED" } }),
      prisma.clientKycProfile.count({ where: { organizationId, nextKycReviewAt: { lt: new Date() } } }),
      prisma.document.count({ where: { organizationId, status: { in: ["REQUIRED", "REQUESTED", "EXPIRED"] } } }),
      prisma.clientConsent.count({ where: { organizationId, status: "REVOKED" } }),
      prisma.complianceAlert.count({ where: { organizationId, severity: { in: ["CRITICAL", "HIGH"] }, status: "OPEN" } }),
      prisma.complianceAlert.count({ where: { organizationId, status: "OPEN" } }),
      prisma.clientKycProfile.aggregate({ where: { organizationId }, _avg: { complianceScore: true } }),
    ])

    return ok({
      totalClients,
      incompleteKyc,
      approvedKyc,
      expiredKyc,
      reviewsDue,
      missingDocuments,
      revokedConsents,
      criticalAlerts,
      openAlerts,
      averageComplianceScore: Math.round(averageScore._avg.complianceScore ?? 0),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
