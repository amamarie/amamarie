import { fail, handleApiError, ok } from "@/lib/api-response"
import { findClientPortalRecord, getClientPortalApiUser } from "@/lib/client-portal"
import { createAuditLog } from "@/lib/compliance/audit"
import { privacyRequestDueDate } from "@/lib/privacy/service"
import { prisma } from "@/lib/prisma"

const allowedRequestTypes = new Set(["ACCESS", "RECTIFICATION", "PORTABILITY", "CONSENT_WITHDRAWAL", "DELETION", "QUESTION"])

function cleanRequestType(value: unknown) {
  const requestType = typeof value === "string" ? value.trim().toUpperCase() : "ACCESS"
  return allowedRequestTypes.has(requestType) ? requestType : "QUESTION"
}

export async function GET() {
  try {
    const user = await getClientPortalApiUser()
    const client = await findClientPortalRecord(user.email)
    if (!client) return fail("CLIENT_NOT_LINKED", "Aucun dossier client n’est lié à ce courriel.", 404)

    return ok(await prisma.privacyRequest.findMany({
      where: { organizationId: client.organizationId, clientId: client.id },
      orderBy: { receivedAt: "desc" },
      take: 20,
    }))
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_CLIENT_PORTAL") return fail("FORBIDDEN", "Accès client requis.", 403)
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getClientPortalApiUser()
    const client = await findClientPortalRecord(user.email)
    if (!client) return fail("CLIENT_NOT_LINKED", "Aucun dossier client n’est lié à ce courriel.", 404)

    const body = await request.json().catch(() => ({}))
    const requestType = cleanRequestType(body.requestType)
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "Demande créée depuis le portail client."
    const privacyRequest = await prisma.privacyRequest.create({
      data: {
        organizationId: client.organizationId,
        clientId: client.id,
        assignedToId: client.advisorId ?? undefined,
        requestType,
        status: "RECEIVED",
        receivedAt: new Date(),
        dueAt: privacyRequestDueDate(),
        notes,
        metadata: {
          source: "CLIENT_PORTAL",
          submittedByUserId: user.id,
        },
      },
    })

    await createAuditLog({
      organizationId: client.organizationId,
      userId: user.id,
      clientId: client.id,
      entityType: "PrivacyRequest",
      entityId: privacyRequest.id,
      action: "PRIVACY_REQUEST_SUBMITTED_BY_CLIENT",
      newValue: { requestType, status: privacyRequest.status },
    })

    await prisma.activity.create({
      data: {
        organizationId: client.organizationId,
        userId: user.id,
        clientId: client.id,
        type: "TASK_CREATED",
        title: "Demande confidentialité reçue",
        description: requestType,
        source: "CLIENT_PORTAL",
        entityType: "PrivacyRequest",
        entityId: privacyRequest.id,
      },
    })

    if (client.advisorId) {
      await prisma.notification.create({
        data: {
          organizationId: client.organizationId,
          userId: client.advisorId,
          type: "INFO",
          priority: "HIGH",
          status: "UNREAD",
          title: "Demande confidentialité client",
          message: `${client.firstName} ${client.lastName}: ${requestType}`,
          actionLabel: "Ouvrir le dossier",
          actionUrl: `/clients/${client.id}`,
          href: `/clients/${client.id}`,
          entityType: "PrivacyRequest",
          entityId: privacyRequest.id,
          clientId: client.id,
        },
      })
    }

    return ok(privacyRequest, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_CLIENT_PORTAL") return fail("FORBIDDEN", "Accès client requis.", 403)
    return handleApiError(error)
  }
}
