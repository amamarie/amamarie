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
    const existing = await prisma.clientConsent.findFirst({
      where: { id: consentId, organizationId: client.organizationId, clientId: client.id },
      include: { purpose: { select: { name: true, code: true } } },
    })
    if (!existing) return fail("NOT_FOUND", "Consentement introuvable.", 404)
    if (!["REQUESTED", "NOT_REQUESTED", "DECLINED"].includes(existing.status)) return fail("CONSENT_NOT_REQUESTED", "Ce consentement ne peut pas être accepté dans son état actuel.", 409)

    const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null
    const userAgent = request.headers.get("user-agent") ?? null
    const consent = await prisma.clientConsent.update({
      where: { id: consentId },
      data: { status: "GIVEN", givenAt: new Date(), ipAddress, userAgent, method: "CLIENT_PORTAL" },
      include: { purpose: true, template: true, events: { orderBy: { createdAt: "desc" }, take: 5 } },
    })

    await createConsentEvent({
      organizationId: client.organizationId,
      consentId,
      eventType: "ACCEPTED",
      actorType: "CLIENT",
      actorId: user.id,
      metadata: { ipAddress, userAgent, source: "client_portal" },
    })
    await createAuditLog({
      organizationId: client.organizationId,
      userId: user.id,
      clientId: client.id,
      entityType: "ClientConsent",
      entityId: consentId,
      action: "CONSENT_ACCEPTED_BY_CLIENT",
      oldValue: { status: existing.status },
      newValue: { status: "GIVEN", purpose: existing.purpose?.code ?? existing.type },
    })
    await prisma.activity.create({
      data: {
        organizationId: client.organizationId,
        userId: user.id,
        clientId: client.id,
        type: "CONSENT_GIVEN",
        title: "Consentement accepté depuis le portail",
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
