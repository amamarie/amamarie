import { fail, handleApiError, ok } from "@/lib/api-response"
import { updateTask } from "@/lib/services/tasks"
import { getTenantContext } from "@/lib/tenant"
import { taskStatusUpdateSchema } from "@/lib/validations/task"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = taskStatusUpdateSchema.parse(await request.json())
    return ok(await updateTask({ organizationId, userId, id, data: payload }))
  } catch (error) {
    if (error instanceof Error && error.message === "TASK_NOT_FOUND") return fail("NOT_FOUND", "Tâche introuvable.", 404)
    return handleApiError(error)
  }
}
