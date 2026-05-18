import { fail, handleApiError, ok } from "@/lib/api-response"
import { overridePriorityItem } from "@/lib/prioritization/actions"
import { getTenantContext } from "@/lib/tenant"
import { overridePrioritySchema } from "@/lib/validations/priority"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = overridePrioritySchema.parse(await request.json())
    return ok(await overridePriorityItem({ organizationId, userId, id, level: payload.level, reason: payload.reason }))
  } catch (error) {
    if (error instanceof Error && error.message === "PRIORITY_NOT_FOUND") return fail("NOT_FOUND", "Priorité introuvable.", 404)
    return handleApiError(error)
  }
}
