import { ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { prisma } from "@/lib/prisma"
import { archiveDocument, getDocumentById, updateDocument } from "@/lib/services/documents"
import { getTenantContext } from "@/lib/tenant"
import { updateDocumentSchema } from "@/lib/validations/document"

type RouteContext = { params: Promise<{ id: string }> }

async function getCurrentTenantUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({
    where: { id: tenant.userId, organizationId: tenant.organizationId },
    select: { id: true, organizationId: true, role: true },
  })
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentTenantUser()
    return ok(await getDocumentById({ user, id }))
  } catch (error) {
    return handleDocumentError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentTenantUser()
    const payload = updateDocumentSchema.parse(await request.json())
    return ok(await updateDocument({ user, id, data: payload }))
  } catch (error) {
    return handleDocumentError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentTenantUser()
    return ok(await archiveDocument({ user, id }))
  } catch (error) {
    return handleDocumentError(error)
  }
}
