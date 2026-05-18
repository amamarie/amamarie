import { fail, handleApiError, ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { createAuditLog } from "@/lib/compliance/audit"
import { generateComplianceAlertsForClient } from "@/lib/compliance/generate"
import { prisma } from "@/lib/prisma"
import { createConsentEvent } from "@/lib/privacy/service"
import { getTenantContext } from "@/lib/tenant"
import { revokeConsentSchema } from "@/lib/validations/consent"

type RouteContext = { params: Promise<{ id: string; consentId: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id, consentId } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = revokeConsentSchema.parse(await request.json().catch(() => ({})))
    const existing = await prisma.clientConsent.findFirst({ where: { id: consentId, clientId: id, organizationId } })
    if (!existing) return fail("NOT_FOUND", "Consentement introuvable.", 404)
    await prisma.clientConsent.updateMany({
      where: { id: consentId, clientId: id, organizationId },
      data: { status: "REVOKED", revokedAt: new Date(), notes: payload.notes ?? existing.notes },
    })
    const consent = await prisma.clientConsent.findFirstOrThrow({ where: { id: consentId, clientId: id, organizationId } })
    await createConsentEvent({
      organizationId,
      consentId: consent.id,
      eventType: "WITHDRAWN",
      actorType: "ADVISOR",
      actorId: userId,
      metadata: { notes: payload.notes ?? null },
    })
    await createCrmActivity({ organizationId, userId, clientId: id, type: "CONSENT_REVOKED", title: "Consentement révoqué", description: consent.type })
    await createAuditLog({ organizationId, userId, clientId: id, entityType: "CONSENT", entityId: consent.id, action: "CONSENT_REVOKED", newValue: { status: "REVOKED" } })
    await generateComplianceAlertsForClient({ organizationId, clientId: id, userId })
    return ok(consent)
  } catch (error) {
    return handleApiError(error)
  }
}
