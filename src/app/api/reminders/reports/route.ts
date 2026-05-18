import { handleApiError, ok } from "@/lib/api-response"
import { getSmartReminderReport } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

export async function GET(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const url = new URL(request.url)
    const scope = url.searchParams.get("scope")
    return ok(await getSmartReminderReport({ organizationId, advisorId: scope === "advisor" ? userId : undefined }))
  } catch (error) {
    return handleApiError(error)
  }
}
