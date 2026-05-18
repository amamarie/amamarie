import { handleApiError, ok } from "@/lib/api-response"
import { dismissRecommendation } from "@/lib/recommendations/actions"
import { getTenantContext } from "@/lib/tenant"
import { dismissRecommendationSchema } from "@/lib/validations/recommendation"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = dismissRecommendationSchema.parse(await request.json().catch(() => ({})))
    const recommendation = await dismissRecommendation({
      id,
      organizationId,
      userId,
      reason: payload.reason,
    })
    return ok(recommendation)
  } catch (error) {
    return handleApiError(error)
  }
}
