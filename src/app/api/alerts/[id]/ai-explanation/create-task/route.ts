import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createTaskFromAlertAiExplanation } from "@/lib/ai/alert-explanations/actions"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

const createTaskSchema = z.object({
  actionIndex: z.number().int().min(0).optional(),
})

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = createTaskSchema.parse(await request.json().catch(() => ({})))
    return ok(await createTaskFromAlertAiExplanation({ organizationId, alertId: id, userId, actionIndex: payload.actionIndex }), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "AI_EXPLANATION_NOT_FOUND") {
      return fail("NOT_FOUND", "Explication IA introuvable.", 404)
    }
    return handleApiError(error)
  }
}
