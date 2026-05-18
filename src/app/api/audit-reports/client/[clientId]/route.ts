import { handleApiError, ok } from "@/lib/api-response"
import { buildClientAuditReport } from "@/lib/compliance/center"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ clientId: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { clientId } = await params
    const { organizationId, userId } = await getTenantContext()
    return ok(await buildClientAuditReport({ organizationId, userId, clientId }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
