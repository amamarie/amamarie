import { fail, handleApiError, ok } from "@/lib/api-response"
import { dismissPriorityItem } from "@/lib/prioritization/actions"
import { getTenantContext } from "@/lib/tenant"
import { dismissPrioritySchema } from "@/lib/validations/priority"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = dismissPrioritySchema.parse(await request.json())
    return ok(await dismissPriorityItem({ organizationId, userId, id, dismissedReason: payload.dismissedReason }))
  } catch (error) {
    if (error instanceof Error && error.message === "PRIORITY_NOT_FOUND") return fail("NOT_FOUND", "Priorité introuvable.", 404)
    return handleApiError(error)
  }
}
