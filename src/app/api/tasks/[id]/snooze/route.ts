import { fail, handleApiError, ok } from "@/lib/api-response"
import { snoozeTask } from "@/lib/services/tasks"
import { getTenantContext } from "@/lib/tenant"
import { snoozeTaskSchema } from "@/lib/validations/task"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = snoozeTaskSchema.parse(await request.json())
    return ok(await snoozeTask({ organizationId, userId, id, snoozedUntil: payload.snoozedUntil, snoozeReason: payload.snoozeReason }))
  } catch (error) {
    if (error instanceof Error && error.message === "TASK_NOT_FOUND") return fail("NOT_FOUND", "Tâche introuvable.", 404)
    return handleApiError(error)
  }
}
