import { fail, handleApiError, ok } from "@/lib/api-response"
import { markAlertAiExplanationReviewed } from "@/lib/ai/alert-explanations/actions"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    return ok(await markAlertAiExplanationReviewed({ organizationId, alertId: id, userId }))
  } catch (error) {
    if (error instanceof Error && error.message === "AI_EXPLANATION_NOT_FOUND") {
      return fail("NOT_FOUND", "Explication IA introuvable.", 404)
    }
    return handleApiError(error)
  }
}
