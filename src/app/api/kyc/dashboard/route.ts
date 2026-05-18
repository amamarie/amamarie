import { fail, handleApiError, ok } from "@/lib/api-response"
import { evaluateKycProfile } from "@/lib/compliance/kyc-engine"
import { ensureKycPolicySettings } from "@/lib/compliance/kyc-advanced"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    const { organizationId } = await getTenantContext()
    const settings = await ensureKycPolicySettings(organizationId)

    const [clients, goalsCount, versionsCount, accessCount] = await Promise.all([
      prisma.client.findMany({
        where: { organizationId, status: { not: "ARCHIVED" } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          advisor: { select: { name: true } },
          kycCompleted: true,
          kycDate: true,
          nextReviewDate: true,
          kycProfile: true,
          investmentProfile: true,
          financialGoalItems: { select: { id: true } },
          kycVersions: { orderBy: { versionNumber: "desc" }, take: 1, select: { id: true, versionNumber: true, lockedAt: true, usedForRecommendationAt: true } },
          kycAlerts: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { id: true, severity: true, title: true, alertType: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 200,
      }),
      prisma.financialGoal.count({ where: { organizationId } }),
      prisma.kycVersion.count({ where: { organizationId } }),
      prisma.kycAccessLog.count({ where: { organizationId } }),
    ])

    const rows = clients.map((client) => {
      const evaluation = evaluateKycProfile(client.kycProfile)
      const latestVersion = client.kycVersions[0] ?? null
      return {
        id: client.id,
        clientName: `${client.firstName} ${client.lastName}`.trim(),
        advisorName: client.advisor?.name ?? "Non assigné",
        completionScore: evaluation.completionScore,
        freshnessScore: evaluation.freshnessScore,
        coherenceScore: evaluation.coherenceScore,
        recommendationReady: evaluation.recommendationReady,
        finalRiskProfile: evaluation.finalRiskProfile,
        status: client.kycProfile?.status ?? "NOT_STARTED",
        reviewStatus: client.kycProfile?.reviewStatus ?? null,
        nextReviewAt: client.kycProfile?.nextKycReviewAt ?? client.nextReviewDate,
        alertCount: client.kycAlerts.length,
        highAlertCount: client.kycAlerts.filter((alert) => alert.severity === "HIGH" || alert.severity === "CRITICAL").length,
        goalCount: client.financialGoalItems.length,
        latestVersion,
        href: `/clients/${client.id}?tab=compliance&focus=kyc`,
      }
    })

    return ok({
      settings,
      metrics: {
        total: rows.length,
        toUpdate: rows.filter((row) => row.freshnessScore < settings.freshnessThreshold || row.status === "EXPIRED" || row.status === "NEEDS_UPDATE").length,
        awaitingClient: rows.filter((row) => !row.recommendationReady && row.completionScore >= settings.completionThreshold).length,
        advisorReview: rows.filter((row) => row.reviewStatus === "READY_FOR_ADVISOR_REVIEW" || row.status === "PENDING_REVIEW").length,
        inconsistencies: rows.filter((row) => row.coherenceScore < settings.coherenceThreshold || row.highAlertCount > 0).length,
        blockedRecommendations: rows.filter((row) => !row.recommendationReady).length,
        goals: goalsCount,
        versions: versionsCount,
        accessLogs: accessCount,
      },
      rows,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
