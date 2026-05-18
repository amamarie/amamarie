import { ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { prisma } from "@/lib/prisma"
import { archiveDocument } from "@/lib/services/documents"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const tenant = await getTenantContext()
    const user = await prisma.user.findFirstOrThrow({ where: { id: tenant.userId, organizationId: tenant.organizationId }, select: { id: true, organizationId: true, role: true } })
    return ok(await archiveDocument({ user, id }))
  } catch (error) {
    return handleDocumentError(error)
  }
}
