import { handleApiError, ok } from "@/lib/api-response"
import { discussCrossSell } from "@/lib/cross-sell/actions"
import { getTenantContext } from "@/lib/tenant"
import { markDiscussedSchema } from "@/lib/validations/cross-sell"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = markDiscussedSchema.parse(await request.json().catch(() => ({})))
    return ok(await discussCrossSell({ id, organizationId, userId, note: payload.note, discussedAt: payload.discussedAt }))
  } catch (error) {
    return handleApiError(error)
  }
}
