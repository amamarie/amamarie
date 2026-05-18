import { fail, handleApiError, ok } from "@/lib/api-response"
import { assignPriorityItem } from "@/lib/prioritization/actions"
import { getTenantContext } from "@/lib/tenant"
import { assignPrioritySchema } from "@/lib/validations/priority"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = assignPrioritySchema.parse(await request.json())
    return ok(await assignPriorityItem({ organizationId, userId, id, advisorId: payload.advisorId }))
  } catch (error) {
    if (error instanceof Error && error.message === "PRIORITY_NOT_FOUND") return fail("NOT_FOUND", "Priorité introuvable.", 404)
    if (error instanceof Error && error.message === "ADVISOR_NOT_FOUND") return fail("NOT_FOUND", "Conseiller introuvable.", 404)
    return handleApiError(error)
  }
}
