import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { createActivity } from "@/lib/services/activities"
import { updateTask } from "@/lib/services/tasks"
import { getTenantContext } from "@/lib/tenant"
import { updateTaskSchema } from "@/lib/validations/task"

type RouteContext = { params: Promise<{ id: string }> }

const include = { assignedTo: true, createdBy: true, lead: true, client: true, product: true }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const task = await prisma.task.findFirst({ where: { id, organizationId }, include })
    if (!task) return fail("NOT_FOUND", "Tâche introuvable.", 404)
    return ok(task)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const data = updateTaskSchema.parse(await request.json())
    return ok(await updateTask({ organizationId, userId, id, data }))
  } catch (error) {
    if (error instanceof Error && error.message === "TASK_NOT_FOUND") return fail("NOT_FOUND", "Tâche introuvable.", 404)
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const task = await prisma.task.findFirst({ where: { id, organizationId } })
    if (!task) return fail("NOT_FOUND", "Tâche introuvable.", 404)
    await prisma.task.updateMany({ where: { id, organizationId }, data: { status: "ARCHIVED" } })
    const archived = await prisma.task.findFirstOrThrow({ where: { id, organizationId }, include })
    await createActivity({
      organizationId,
      userId,
      leadId: archived.leadId,
      clientId: archived.clientId,
      taskId: archived.id,
      type: "TASK_UPDATED",
      title: "Tâche archivée",
      description: archived.title,
      entityType: "Task",
      entityId: archived.id,
    })
    return ok(archived)
  } catch (error) {
    return handleApiError(error)
  }
}
