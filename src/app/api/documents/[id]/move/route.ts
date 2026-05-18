import { ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { prisma } from "@/lib/prisma"
import { moveDocumentToFolder } from "@/lib/services/document-folders"
import { getTenantContext } from "@/lib/tenant"
import { moveDocumentSchema } from "@/lib/validations/document"

type RouteContext = { params: Promise<{ id: string }> }

async function currentUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({ where: { id: tenant.userId, organizationId: tenant.organizationId }, select: { id: true, organizationId: true, role: true } })
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await currentUser()
    const data = moveDocumentSchema.parse(await request.json())
    return ok(await moveDocumentToFolder({ user, documentId: id, folderId: data.folderId }))
  } catch (error) {
    return handleDocumentError(error)
  }
}
