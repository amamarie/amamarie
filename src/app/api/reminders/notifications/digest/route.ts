import { handleApiError, ok } from "@/lib/api-response"
import { sendSmartReminderDigest } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const advisorId = typeof body.advisorId === "string" ? body.advisorId : undefined
    return ok(await sendSmartReminderDigest({ organizationId, userId, advisorId }))
  } catch (error) {
    return handleApiError(error)
  }
}
