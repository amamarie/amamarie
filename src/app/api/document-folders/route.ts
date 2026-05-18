import { ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { prisma } from "@/lib/prisma"
import { createDocumentFolder, getDocumentFolders } from "@/lib/services/document-folders"
import { getTenantContext } from "@/lib/tenant"
import { createDocumentFolderSchema, documentFolderQuerySchema } from "@/lib/validations/document"

async function currentUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({ where: { id: tenant.userId, organizationId: tenant.organizationId }, select: { id: true, organizationId: true, role: true } })
}

export async function GET(request: Request) {
  try {
    const user = await currentUser()
    const query = documentFolderQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams))
    return ok(await getDocumentFolders({ user, query }))
  } catch (error) {
    return handleDocumentError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await currentUser()
    const data = createDocumentFolderSchema.parse(await request.json())
    return ok(await createDocumentFolder({ user, data }), { status: 201 })
  } catch (error) {
    return handleDocumentError(error)
  }
}
