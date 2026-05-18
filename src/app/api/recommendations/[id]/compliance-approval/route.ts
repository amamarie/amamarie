import { handleApiError, ok } from "@/lib/api-response"
import { approveRecommendationByCompliance } from "@/lib/recommendations/documented"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const recommendation = await approveRecommendationByCompliance({ id, organizationId, userId })
    return ok(recommendation)
  } catch (error) {
    return handleApiError(error)
  }
}
