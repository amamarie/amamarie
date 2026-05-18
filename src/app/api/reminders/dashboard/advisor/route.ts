import { handleApiError, ok } from "@/lib/api-response"
import { getSmartReminderDashboard } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId, userId } = await getTenantContext()
    return ok(await getSmartReminderDashboard({ organizationId, advisorId: userId }))
  } catch (error) {
    return handleApiError(error)
  }
}
