import { handleApiError, ok } from "@/lib/api-response"
import { refreshMarketingLeadScores } from "@/lib/marketing/automation"
import { assertMarketingPermission } from "@/lib/marketing/permissions"
import { getTenantContext } from "@/lib/tenant"

export async function POST() {
  try {
    const { organizationId, role } = await getTenantContext()
    assertMarketingPermission(role, "automation")
    return ok(await refreshMarketingLeadScores({ organizationId }))
  } catch (error) {
    return handleApiError(error)
  }
}
