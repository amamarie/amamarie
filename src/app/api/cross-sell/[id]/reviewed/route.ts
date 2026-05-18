import { handleApiError, ok } from "@/lib/api-response"
import { markCrossSellReviewed } from "@/lib/cross-sell/actions"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    return ok(await markCrossSellReviewed({ id, organizationId, userId }))
  } catch (error) {
    return handleApiError(error)
  }
}
