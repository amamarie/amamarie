import { handleApiError, ok } from "@/lib/api-response"
import { getMarketingOverview } from "@/lib/marketing/automation"
import { assertMarketingPermission } from "@/lib/marketing/permissions"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId, role } = await getTenantContext()
    assertMarketingPermission(role, "view")
    return ok(await getMarketingOverview({ organizationId }))
  } catch (error) {
    return handleApiError(error)
  }
}
