import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const privacyRequest = await prisma.privacyRequest.findFirst({ where: { id, organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true } }, assignedTo: { select: { id: true, name: true, role: true } } } })
    if (!privacyRequest) return fail("NOT_FOUND", "Demande introuvable.", 404)
    return ok(privacyRequest)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const existing = await prisma.privacyRequest.findFirst({ where: { id, organizationId }, select: { id: true, clientId: true } })
    if (!existing) return fail("NOT_FOUND", "Demande introuvable.", 404)
    const privacyRequest = await prisma.privacyRequest.update({
      where: { id },
      data: {
        status: typeof body.status === "string" ? body.status : undefined,
        assignedToId: typeof body.assignedToId === "string" ? body.assignedToId : undefined,
        identityVerified: typeof body.identityVerified === "boolean" ? body.identityVerified : undefined,
        responseDocumentId: typeof body.responseDocumentId === "string" ? body.responseDocumentId : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        closedAt: body.status === "CLOSED" ? new Date() : undefined,
      },
    })
    await createAuditLog({ organizationId, userId, clientId: existing.clientId, entityType: "PrivacyRequest", entityId: id, action: "PRIVACY_REQUEST_UPDATED", newValue: { status: privacyRequest.status } })
    return ok(privacyRequest)
  } catch (error) {
    return handleApiError(error)
  }
}
