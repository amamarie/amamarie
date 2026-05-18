import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const existing = await prisma.privacyRequest.findFirst({ where: { id, organizationId }, select: { id: true, clientId: true } })
    if (!existing) return fail("NOT_FOUND", "Demande introuvable.", 404)
    const privacyRequest = await prisma.privacyRequest.update({
      where: { id },
      data: { status: "CLOSED", closedAt: new Date(), notes: typeof body.notes === "string" ? body.notes : undefined },
    })
    await createAuditLog({ organizationId, userId, clientId: existing.clientId, entityType: "PrivacyRequest", entityId: id, action: "PRIVACY_REQUEST_CLOSED", newValue: { notes: body.notes ?? null } })
    return ok(privacyRequest)
  } catch (error) {
    return handleApiError(error)
  }
}
