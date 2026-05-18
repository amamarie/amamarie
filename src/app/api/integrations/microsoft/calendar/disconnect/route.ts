import { handleApiError, ok } from "@/lib/api-response"
import { disconnectMicrosoftCalendar } from "@/lib/microsoft/calendar"
import { getTenantContext } from "@/lib/tenant"

export async function POST() {
  try {
    const { organizationId, userId } = await getTenantContext()
    await disconnectMicrosoftCalendar({ organizationId, userId })
    return ok({ connected: false })
  } catch (error) {
    return handleApiError(error)
  }
}
