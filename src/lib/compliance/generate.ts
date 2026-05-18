import { createCrmActivity } from "@/lib/crm-events"
import { generateComplianceAlertCandidates } from "@/lib/compliance/alerts"
import { prisma } from "@/lib/prisma"

export async function generateComplianceAlertsForClient({
  organizationId,
  clientId,
  userId,
}: {
  organizationId: string
  clientId: string
  userId?: string | null
}) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    include: {
      kycProfile: true,
      documents: true,
      consents: true,
      products: true,
    },
  })
  if (!client) throw new Error("Client introuvable.")

  const candidates = generateComplianceAlertCandidates({
    client,
    kyc: client.kycProfile,
    documents: client.documents,
    consents: client.consents,
    products: client.products,
  })

  const activeAlerts = await prisma.complianceAlert.findMany({
    where: { organizationId, clientId, status: { in: ["OPEN", "IN_PROGRESS"] } },
  })
  const candidateTypes = new Set(candidates.map((candidate) => candidate.type))

  for (const candidate of candidates) {
    const existing = activeAlerts.find((alert) => alert.type === candidate.type)
    if (existing) {
      await prisma.complianceAlert.updateMany({
        where: { id: existing.id, organizationId },
        data: {
          severity: candidate.severity,
          title: candidate.title,
          description: candidate.description,
          actionLabel: candidate.actionLabel,
          actionUrl: candidate.actionUrl,
        },
      })
      continue
    }

    const alert = await prisma.complianceAlert.create({
      data: {
        organizationId,
        clientId,
        type: candidate.type,
        severity: candidate.severity,
        title: candidate.title,
        description: candidate.description,
        actionLabel: candidate.actionLabel,
        actionUrl: candidate.actionUrl,
      },
    })

    await createCrmActivity({
      organizationId,
      userId,
      clientId,
      type: "COMPLIANCE_ALERT_CREATED",
      title: "Alerte conformité créée",
      description: alert.title,
    })
  }

  const stale = activeAlerts.filter((alert) => !candidateTypes.has(alert.type))
  if (stale.length > 0) {
    await prisma.complianceAlert.updateMany({
      where: { id: { in: stale.map((alert) => alert.id) } },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: userId },
    })
  }

  return prisma.complianceAlert.findMany({
    where: { organizationId, clientId },
    orderBy: [{ status: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
  })
}
