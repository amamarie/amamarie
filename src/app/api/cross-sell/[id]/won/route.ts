import { handleApiError, ok } from "@/lib/api-response"
import { winCrossSell } from "@/lib/cross-sell/actions"
import { getTenantContext } from "@/lib/tenant"
import { markWonSchema } from "@/lib/validations/cross-sell"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = markWonSchema.parse(await request.json().catch(() => ({})))
    return ok(await winCrossSell({ id, organizationId, userId, productId: payload.productId, note: payload.note }))
  } catch (error) {
    return handleApiError(error)
  }
}
