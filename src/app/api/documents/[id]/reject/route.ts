import { ok } from "@/lib/api-response"
import { handleDocumentError } from "@/lib/documents/api-errors"
import { prisma } from "@/lib/prisma"
import { rejectDocument } from "@/lib/services/documents"
import { getTenantContext } from "@/lib/tenant"
import { rejectDocumentSchema } from "@/lib/validations/document"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const tenant = await getTenantContext()
    const user = await prisma.user.findFirstOrThrow({ where: { id: tenant.userId, organizationId: tenant.organizationId }, select: { id: true, organizationId: true, role: true } })
    const payload = rejectDocumentSchema.parse(await request.json())
    return ok(await rejectDocument({ user, id, rejectedReason: payload.rejectedReason, notes: payload.notes }))
  } catch (error) {
    return handleDocumentError(error)
  }
}
