import { fail, handleApiError, ok } from "@/lib/api-response"
import { findClientPortalRecord, getClientPortalApiUser } from "@/lib/client-portal"
import { createAuditLog } from "@/lib/compliance/audit"
import { createConsentEvent } from "@/lib/privacy/service"
import { prisma } from "@/lib/prisma"

type RouteContext = { params: Promise<{ consentId: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await getClientPortalApiUser()
    const client = await findClientPortalRecord(user.email)
    if (!client) return fail("CLIENT_NOT_LINKED", "Aucun dossier client n’est lié à ce courriel.", 404)

    const { consentId } = await params
    const body = await request.json().catch(() => ({}))
    const reason = typeof body.reason === "string" && body.reason.trim().length > 0 ? body.reason.trim() : "Retrait demandé depuis le portail client."

    const existing = await prisma.clientConsent.findFirst({
      where: { id: consentId, organizationId: client.organizationId, clientId: client.id },
      include: { purpose: { select: { name: true, code: true } } },
    })
    if (!existing) return fail("NOT_FOUND", "Consentement introuvable.", 404)
    if (!existing.withdrawalAllowed) return fail("WITHDRAWAL_NOT_ALLOWED", "Ce consentement ne peut pas être retiré directement depuis le portail.", 409)
    if (existing.status !== "GIVEN") return fail("CONSENT_NOT_ACTIVE", "Ce consentement n’est pas actif.", 409)

    const consent = await prisma.clientConsent.update({
      where: { id: consentId },
      data: { status: "REVOKED", revokedAt: new Date(), notes: reason },
      include: { purpose: true, template: true, events: { orderBy: { createdAt: "desc" }, take: 5 } },
    })

    await createConsentEvent({
      organizationId: client.organizationId,
      consentId,
      eventType: "WITHDRAWN",
      actorType: "CLIENT",
      actorId: user.id,
      metadata: { reason },
    })

    await createAuditLog({
      organizationId: client.organizationId,
      userId: user.id,
      clientId: client.id,
      entityType: "ClientConsent",
      entityId: consentId,
      action: "CONSENT_WITHDRAWN_BY_CLIENT",
      oldValue: { status: existing.status },
      newValue: { status: "REVOKED", purpose: existing.purpose?.code ?? existing.type },
    })

    await prisma.activity.create({
      data: {
        organizationId: client.organizationId,
        userId: user.id,
        clientId: client.id,
        type: "CONSENT_REVOKED",
        title: "Consentement retiré depuis le portail",
        description: existing.purpose?.name ?? existing.type,
        source: "CLIENT_PORTAL",
        entityType: "ClientConsent",
        entityId: consentId,
      },
    })

    return ok(consent)
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_CLIENT_PORTAL") return fail("FORBIDDEN", "Accès client requis.", 403)
    return handleApiError(error)
  }
}
