import { ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { prisma } from "@/lib/prisma"
import { waiveDocument } from "@/lib/services/documents"
import { getTenantContext } from "@/lib/tenant"
import { waiveDocumentSchema } from "@/lib/validations/document"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const tenant = await getTenantContext()
    const user = await prisma.user.findFirstOrThrow({ where: { id: tenant.userId, organizationId: tenant.organizationId }, select: { id: true, organizationId: true, role: true } })
    const payload = waiveDocumentSchema.parse(await request.json())
    return ok(await waiveDocument({ user, id, waiverReason: payload.waiverReason, notes: payload.notes }))
  } catch (error) {
    return handleDocumentError(error)
  }
}
