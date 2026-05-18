import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { buildPrivacyExportPayload } from "@/lib/privacy/export"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const user = await prisma.user.findFirst({ where: { id: userId, organizationId }, select: { role: true } })
    return ok(await buildPrivacyExportPayload({ organizationId, userId, requestId: id, request, role: user?.role }))
  } catch (error) {
    return handleApiError(error)
  }
}
