import { fail, ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { prisma } from "@/lib/prisma"
import { requestClientDocument, requestClientDocuments } from "@/lib/services/document-requests"
import { getTenantContext } from "@/lib/tenant"
import { requestClientDocumentSchema, requestClientDocumentsSchema } from "@/lib/validations/document"

type RouteContext = { params: Promise<{ id: string }> }

async function currentUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({
    where: { id: tenant.userId, organizationId: tenant.organizationId },
    select: { id: true, organizationId: true, role: true, name: true, email: true },
  })
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await currentUser()
    const client = await prisma.client.findFirst({ where: { id, organizationId: user.organizationId }, select: { id: true } })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)

    const body = await request.json()
    const result = Array.isArray(body?.documents)
      ? await requestClientDocuments({ user, clientId: id, data: requestClientDocumentsSchema.parse(body) })
      : await requestClientDocument({ user, clientId: id, data: requestClientDocumentSchema.parse(body) })
    return ok(result, { status: 201 })
  } catch (error) {
    return handleDocumentError(error)
  }
}
