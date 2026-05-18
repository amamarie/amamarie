import { handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { notifyPrivacyIncident } from "@/lib/privacy/notifications"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const target = body.target === "CAI" || body.target === "CLIENTS" || body.target === "INTERNAL" || body.target === "SERIOUS_HARM" ? body.target : "INTERNAL"
    const logs = target === "SERIOUS_HARM"
      ? [
          ...(await notifyPrivacyIncident({ organizationId, userId, incidentId: id, target: "CAI" })),
          ...(await notifyPrivacyIncident({ organizationId, userId, incidentId: id, target: "CLIENTS" })),
          ...(await notifyPrivacyIncident({ organizationId, userId, incidentId: id, target: "INTERNAL" })),
        ]
      : await notifyPrivacyIncident({ organizationId, userId, incidentId: id, target })
    await createAuditLog({ organizationId, userId, entityType: "PrivacyIncident", entityId: id, action: "PRIVACY_INCIDENT_NOTIFICATION_SENT", newValue: { target } })
    return ok({ target, logs })
  } catch (error) {
    return handleApiError(error)
  }
}
