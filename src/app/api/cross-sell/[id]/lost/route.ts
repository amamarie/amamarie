import { handleApiError, ok } from "@/lib/api-response"
import { loseCrossSell } from "@/lib/cross-sell/actions"
import { getTenantContext } from "@/lib/tenant"
import { markLostSchema } from "@/lib/validations/cross-sell"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = markLostSchema.parse(await request.json())
    return ok(await loseCrossSell({ id, organizationId, userId, reason: payload.reason, note: payload.note }))
  } catch (error) {
    return handleApiError(error)
  }
}
