import { ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { prisma } from "@/lib/prisma"
import { archiveDocumentFolder, updateDocumentFolder } from "@/lib/services/document-folders"
import { getTenantContext } from "@/lib/tenant"
import { updateDocumentFolderSchema } from "@/lib/validations/document"

type RouteContext = { params: Promise<{ id: string }> }

async function currentUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({ where: { id: tenant.userId, organizationId: tenant.organizationId }, select: { id: true, organizationId: true, role: true } })
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await currentUser()
    const data = updateDocumentFolderSchema.parse(await request.json())
    return ok(await updateDocumentFolder({ user, id, data }))
  } catch (error) {
    return handleDocumentError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await currentUser()
    return ok(await archiveDocumentFolder({ user, id }))
  } catch (error) {
    return handleDocumentError(error)
  }
}
