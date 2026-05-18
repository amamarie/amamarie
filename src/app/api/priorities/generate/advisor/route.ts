import { fail, handleApiError, ok } from "@/lib/api-response"
import { generatePriorityItemsForAdvisor } from "@/lib/prioritization/engine"
import { getTenantContext } from "@/lib/tenant"
import { assignPrioritySchema } from "@/lib/validations/priority"

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = assignPrioritySchema.parse(await request.json())
    if (!payload.advisorId) return fail("VALIDATION_ERROR", "Conseiller requis.", 422)
    return ok(await generatePriorityItemsForAdvisor({ organizationId, advisorId: payload.advisorId, triggeredById: userId }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
