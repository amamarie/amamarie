import { handleApiError, ok } from "@/lib/api-response"
import { getSmartReminderDashboard } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    return ok(await getSmartReminderDashboard({ organizationId }))
  } catch (error) {
    return handleApiError(error)
  }
}
