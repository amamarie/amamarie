import { handleApiError, ok } from "@/lib/api-response"
import { getMicrosoftCalendarConnectionStatus } from "@/lib/microsoft/calendar"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId, userId } = await getTenantContext()
    return ok(await getMicrosoftCalendarConnectionStatus({ organizationId, userId }))
  } catch (error) {
    return handleApiError(error)
  }
}
