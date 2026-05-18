import { handleApiError, ok } from "@/lib/api-response"
import { getAmlDashboard } from "@/lib/aml/service"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    const dashboard = await getAmlDashboard({ organizationId })
    return ok(dashboard)
  } catch (error) {
    return handleApiError(error)
  }
}
