import { handleApiError, ok } from "@/lib/api-response"
import { convertRecommendationToTask } from "@/lib/recommendations/actions"
import { getTenantContext } from "@/lib/tenant"
import { convertRecommendationToTaskSchema } from "@/lib/validations/recommendation"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = convertRecommendationToTaskSchema.parse(await request.json().catch(() => ({})))
    const result = await convertRecommendationToTask({
      id,
      organizationId,
      userId,
      assignedToId: payload.assignedToId,
      dueDate: payload.dueDate,
      taskTitle: payload.taskTitle,
    })

    return ok(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
