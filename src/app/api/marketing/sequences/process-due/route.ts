import { handleApiError, ok } from "@/lib/api-response"
import { processDueMarketingSequences } from "@/lib/marketing/automation"
import { assertMarketingPermission } from "@/lib/marketing/permissions"
import { getTenantContext } from "@/lib/tenant"

export async function POST() {
  try {
    const { organizationId, userId, role } = await getTenantContext()
    assertMarketingPermission(role, "automation")
    return ok(await processDueMarketingSequences({ organizationId, userId }))
  } catch (error) {
    return handleApiError(error)
  }
}
