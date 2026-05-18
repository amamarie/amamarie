import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    return ok(await prisma.privacyIncident.findMany({ where: { organizationId }, include: { detectedBy: { select: { id: true, name: true, role: true } } }, orderBy: { detectedAt: "desc" } }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const incident = await prisma.privacyIncident.create({
      data: {
        organizationId,
        detectedById: userId,
        incidentType: String(body.incidentType ?? "UNAUTHORIZED_ACCESS"),
        status: String(body.status ?? "OPEN"),
        affectedClientsCount: Number(body.affectedClientsCount ?? 0),
        affectedClientIds: body.affectedClientIds ?? undefined,
        affectedDataCategories: body.affectedDataCategories ?? undefined,
        riskLevel: String(body.riskLevel ?? "TO_ASSESS"),
        seriousHarmRisk: Boolean(body.seriousHarmRisk),
        mitigationSteps: typeof body.mitigationSteps === "string" ? body.mitigationSteps : null,
        rootCause: typeof body.rootCause === "string" ? body.rootCause : null,
        correctiveActions: typeof body.correctiveActions === "string" ? body.correctiveActions : null,
        notes: typeof body.notes === "string" ? body.notes : null,
      },
    })
    const affectedClientIds = Array.isArray(body.affectedClientIds) ? body.affectedClientIds.filter((value: unknown): value is string => typeof value === "string") : []
    if (Boolean(body.seriousHarmRisk) && affectedClientIds.length > 0) {
      await Promise.all(affectedClientIds.slice(0, 25).map((clientId: string) => prisma.complianceAlert.create({
        data: {
          organizationId,
          clientId,
          type: "PRIVACY_INCIDENT",
          severity: "CRITICAL",
          status: "OPEN",
          title: "Incident de confidentialité à traiter",
          description: `Incident ${incident.incidentType} avec risque de préjudice sérieux. Évaluer avis, mitigation et documentation.`,
          actionLabel: "Ouvrir conformité",
          actionUrl: `/compliance`,
        },
      })))
    }
    await createAuditLog({ organizationId, userId, entityType: "PrivacyIncident", entityId: incident.id, action: "PRIVACY_INCIDENT_CREATED", newValue: { incidentType: incident.incidentType, riskLevel: incident.riskLevel } })
    return ok(incident, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
