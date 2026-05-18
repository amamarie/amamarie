import { handleApiError, ok, fail } from "@/lib/api-response"
import { createNoteFromAlertAiExplanation } from "@/lib/ai/alert-explanations/actions"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    return ok(await createNoteFromAlertAiExplanation({ organizationId, alertId: id, userId }), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "AI_EXPLANATION_NOT_FOUND") {
      return fail("NOT_FOUND", "Explication IA introuvable.", 404)
    }
    return handleApiError(error)
  }
}
