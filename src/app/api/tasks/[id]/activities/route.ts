import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/db"
import { getActivities } from "@/lib/services/activities"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

function queryObject(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries())
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const { organizationId } = await getTenantContext()

    const task = await prisma.task.findFirst({
      where: { id, organizationId },
      select: { id: true },
    })
    if (!task) return fail("NOT_FOUND", "Tâche introuvable.", 404)

    const activities = await getActivities({
      organizationId,
      query: { ...queryObject(request), taskId: id },
    })
    return ok(activities)
  } catch (error) {
    return handleApiError(error)
  }
}
