import { handleApiError, ok } from "@/lib/api-response"
import { ensureDefaultSmartReminderRules } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

export async function POST() {
  try {
    const { organizationId } = await getTenantContext()
    const rules = await ensureDefaultSmartReminderRules({ organizationId })
    return ok({ count: rules.length, rules }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
