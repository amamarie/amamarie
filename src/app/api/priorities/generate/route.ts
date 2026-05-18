import { handleApiError, ok } from "@/lib/api-response"
import { generatePriorityItemsForOrganization } from "@/lib/prioritization/engine"
import { getTenantContext } from "@/lib/tenant"
import { generatePrioritiesSchema } from "@/lib/validations/priority"

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = generatePrioritiesSchema.parse(await request.json().catch(() => ({})))
    return ok(await generatePriorityItemsForOrganization({ organizationId, advisorId: payload.advisorId, triggeredById: userId }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
