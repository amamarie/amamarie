import { handleApiError, ok } from "@/lib/api-response"
import { ensureDefaultComplianceChecklists } from "@/lib/compliance/default-checklists"
import { getTenantContext } from "@/lib/tenant"

export async function POST() {
  try {
    const { organizationId, userId } = await getTenantContext()
    return ok(await ensureDefaultComplianceChecklists({ organizationId, userId }))
  } catch (error) {
    return handleApiError(error)
  }
}
