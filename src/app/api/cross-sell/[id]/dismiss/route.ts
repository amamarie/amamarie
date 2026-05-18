import { handleApiError, ok } from "@/lib/api-response"
import { dismissCrossSell } from "@/lib/cross-sell/actions"
import { getTenantContext } from "@/lib/tenant"
import { dismissCrossSellSchema } from "@/lib/validations/cross-sell"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = dismissCrossSellSchema.parse(await request.json().catch(() => ({})))
    return ok(await dismissCrossSell({ id, organizationId, userId, reason: payload.reason }))
  } catch (error) {
    return handleApiError(error)
  }
}
