import { ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { prisma } from "@/lib/prisma"
import { updateDocumentStatus } from "@/lib/services/documents"
import { getTenantContext } from "@/lib/tenant"
import { updateDocumentStatusSchema } from "@/lib/validations/document"

type RouteContext = { params: Promise<{ id: string }> }

async function user() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({ where: { id: tenant.userId, organizationId: tenant.organizationId }, select: { id: true, organizationId: true, role: true } })
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const currentUser = await user()
    const payload = updateDocumentStatusSchema.parse(await request.json())
    return ok(await updateDocumentStatus({ user: currentUser, id, status: payload.status, notes: payload.notes, expiresAt: payload.expiresAt }))
  } catch (error) {
    return handleDocumentError(error)
  }
}
