import { handleApiError, ok } from "@/lib/api-response"
import { getTasks } from "@/lib/services/tasks"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    return ok(await getTasks({ organizationId, where: { status: "OVERDUE" } }))
  } catch (error) {
    return handleApiError(error)
  }
}
