import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { createTask } from "@/lib/services/tasks"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const incident = await prisma.privacyIncident.findFirst({ where: { id, organizationId } })
    if (!incident) return fail("NOT_FOUND", "Incident introuvable.", 404)

    const affectedClientIds = Array.isArray(incident.affectedClientIds) ? incident.affectedClientIds.filter((value): value is string => typeof value === "string") : []
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + (incident.seriousHarmRisk ? 1 : 3))

    const task = await createTask({
      organizationId,
      userId,
      data: {
        clientId: affectedClientIds[0],
        type: "COMPLIANCE",
        priority: incident.seriousHarmRisk ? "URGENT" : incident.riskLevel === "HIGH" ? "HIGH" : "NORMAL",
        status: "TODO",
        dueDate,
        title: `Traiter incident confidentialité - ${incident.incidentType}`,
        description: [
          `Incident: ${incident.incidentType}`,
          `Risque: ${incident.riskLevel}`,
          `Préjudice sérieux: ${incident.seriousHarmRisk ? "Oui" : "Non"}`,
          incident.mitigationSteps ? `Mitigation: ${incident.mitigationSteps}` : null,
          "Actions: évaluer avis requis, mesures correctives, documentation et clôture.",
        ].filter(Boolean).join("\n"),
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      clientId: affectedClientIds[0],
      entityType: "PrivacyIncident",
      entityId: incident.id,
      action: "PRIVACY_INCIDENT_TASK_CREATED",
      newValue: { taskId: task.id },
    })

    return ok(task, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
