import { fail, handleApiError, ok } from "@/lib/api-response"
import { cancelTask } from "@/lib/services/tasks"
import { getTenantContext } from "@/lib/tenant"
import { cancelTaskSchema } from "@/lib/validations/task"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = cancelTaskSchema.parse(await request.json())
    return ok(await cancelTask({ organizationId, userId, id, cancelReason: payload.cancelReason }))
  } catch (error) {
    if (error instanceof Error && error.message === "TASK_NOT_FOUND") return fail("NOT_FOUND", "Tâche introuvable.", 404)
    return handleApiError(error)
  }
}
