import { handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import { ensureDefaultAutomationRules } from "@/lib/automation/defaults"
import { getTenantContext } from "@/lib/tenant"

export async function POST() {
  try {
    await requireOwner()
    const { organizationId, userId } = await getTenantContext()
    const result = await ensureDefaultAutomationRules({ organizationId, userId })

    return ok(result, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
