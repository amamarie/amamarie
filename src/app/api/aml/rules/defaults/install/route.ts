import { handleApiError, ok } from "@/lib/api-response"
import { ensureDefaultAmlRiskRules } from "@/lib/aml/service"
import { getTenantContext } from "@/lib/tenant"

export async function POST() {
  try {
    const { organizationId, userId } = await getTenantContext()
    const rules = await ensureDefaultAmlRiskRules({ organizationId, userId })
    return ok({ installed: rules.length, rules })
  } catch (error) {
    return handleApiError(error)
  }
}
