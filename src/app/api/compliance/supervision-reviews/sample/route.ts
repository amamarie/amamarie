import { handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { createComplianceEvent } from "@/lib/compliance/center"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const clients = await prisma.client.findMany({
      where: { organizationId },
      include: {
        advisor: { select: { id: true, name: true } },
        complianceAlerts: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } } },
        complaints: { where: { status: { notIn: ["CLOSED", "ARCHIVED"] } } },
        complianceIncidents: { where: { status: { notIn: ["CLOSED", "ARCHIVED"] } } },
        complianceExceptions: { where: { status: { in: ["REQUESTED", "IN_REVIEW"] } } },
        supervisionReviews: { where: { status: { notIn: ["CLOSED", "APPROVED", "ARCHIVED"] } } },
      },
      take: 500,
    })
    const candidates = clients
      .map((client) => {
        const criticalAlerts = client.complianceAlerts.filter((alert) => alert.severity === "CRITICAL").length
        const score = criticalAlerts * 5 + client.complaints.length * 4 + client.complianceIncidents.length * 4 + client.complianceExceptions.length * 3 + client.complianceAlerts.length
        return { client, score, criticalAlerts }
      })
      .filter((item) => item.score > 0 && item.client.supervisionReviews.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 25)

    const created = []
    for (const { client, score, criticalAlerts } of candidates) {
      const review = await prisma.supervisionReview.create({
        data: {
          organizationId,
          clientId: client.id,
          advisorId: client.advisorId,
          reviewerId: userId,
          reviewType: criticalAlerts > 0 ? "RISK_BASED_REVIEW" : "AUTO_SAMPLE",
          riskLevel: score >= 10 ? "HIGH" : "MEDIUM",
          findings: `Échantillonnage automatique: score ${score}.`,
          requiredCorrections: criticalAlerts > 0 ? "Vérifier les alertes critiques avant toute recommandation ou soumission." : "Revue de supervision à compléter.",
        },
      })
      await createComplianceEvent({
        organizationId,
        userId,
        clientId: client.id,
        eventCategory: "SUPERVISION",
        eventTitle: "Dossier sélectionné pour supervision automatique",
        description: `Score supervision ${score}.`,
        severity: score >= 10 ? "HIGH" : "IMPORTANT",
        assignedToId: userId,
        linkedEntityType: "SupervisionReview",
        linkedEntityId: review.id,
      })
      created.push(review.id)
    }

    await createAuditLog({
      organizationId,
      userId,
      entityType: "SupervisionReview",
      entityId: organizationId,
      action: "SUPERVISION_AUTO_SAMPLE_RUN",
      newValue: { created: created.length, candidates: candidates.length },
      sensitivityLevel: "HIGH",
      source: "api",
      request,
    })
    return ok({ created: created.length, reviewIds: created })
  } catch (error) {
    return handleApiError(error)
  }
}
