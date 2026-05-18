import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { privacyRequestDueDate } from "@/lib/privacy/service"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    return ok(await prisma.privacyRequest.findMany({ where: { organizationId, clientId: id }, include: { assignedTo: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "desc" } }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const client = await prisma.client.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    const receivedAt = new Date()
    const privacyRequest = await prisma.privacyRequest.create({
      data: {
        organizationId,
        clientId: id,
        assignedToId: typeof body.assignedToId === "string" ? body.assignedToId : userId,
        requestType: String(body.requestType ?? "ACCESS"),
        status: String(body.status ?? "RECEIVED"),
        receivedAt,
        dueAt: body.dueAt ? new Date(body.dueAt) : privacyRequestDueDate(receivedAt),
        identityVerified: Boolean(body.identityVerified),
        notes: typeof body.notes === "string" ? body.notes : null,
        metadata: body.metadata ?? undefined,
      },
    })
    await createAuditLog({ organizationId, userId, clientId: id, entityType: "PrivacyRequest", entityId: privacyRequest.id, action: "PRIVACY_REQUEST_CREATED", newValue: { requestType: privacyRequest.requestType, status: privacyRequest.status } })
    return ok(privacyRequest, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
