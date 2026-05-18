import { fail, handleApiError, ok } from "@/lib/api-response"
import { completePriorityItem } from "@/lib/prioritization/actions"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    return ok(await completePriorityItem({ organizationId, userId, id }))
  } catch (error) {
    if (error instanceof Error && error.message === "PRIORITY_NOT_FOUND") return fail("NOT_FOUND", "Priorité introuvable.", 404)
    return handleApiError(error)
  }
}
