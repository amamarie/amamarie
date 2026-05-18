import { handleApiError, ok } from "@/lib/api-response"
import { generateDocumentedRecommendationReport } from "@/lib/recommendations/documented"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const result = await generateDocumentedRecommendationReport({ id, organizationId, userId })
    return ok(result)
  } catch (error) {
    return handleApiError(error)
  }
}
