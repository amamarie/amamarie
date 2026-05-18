import { handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function POST() {
  try {
    const { organizationId, userId } = await getTenantContext()
    const now = new Date()
    const [documentsToReview, expiredConsents] = await Promise.all([
      prisma.document.findMany({ where: { organizationId, deletedAt: null, OR: [{ retentionReviewAt: { lte: now } }, { status: "REJECTED" }] }, select: { id: true, name: true, clientId: true, status: true, retentionReviewAt: true }, take: 100 }),
      prisma.clientConsent.findMany({ where: { organizationId, status: "GIVEN", expiresAt: { lte: now } }, select: { id: true, clientId: true, type: true, expiresAt: true }, take: 100 }),
    ])
    await createAuditLog({ organizationId, userId, entityType: "RetentionReview", entityId: organizationId, action: "RETENTION_REVIEW_RUN", newValue: { documents: documentsToReview.length, expiredConsents: expiredConsents.length } })
    return ok({ documentsToReview, expiredConsents, total: documentsToReview.length + expiredConsents.length })
  } catch (error) {
    return handleApiError(error)
  }
}
