import { fail, handleApiError, ok } from "@/lib/api-response"
import { completeTask } from "@/lib/services/tasks"
import { getTenantContext } from "@/lib/tenant"
import { completeTaskSchema } from "@/lib/validations/task"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = completeTaskSchema.parse(await request.json().catch(() => ({})))
    return ok(await completeTask({ organizationId, userId, id, outcome: payload.outcome }))
  } catch (error) {
    if (error instanceof Error && error.message === "TASK_NOT_FOUND") return fail("NOT_FOUND", "Tâche introuvable.", 404)
    return handleApiError(error)
  }
}
