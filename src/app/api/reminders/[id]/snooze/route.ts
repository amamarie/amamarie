import { handleApiError, ok } from "@/lib/api-response"
import { snoozeSmartReminder } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const snoozedUntil = typeof body.snoozedUntil === "string" ? new Date(body.snoozedUntil) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const reason = typeof body.reason === "string" ? body.reason : "Report temporaire."
    return ok({ reminder: await snoozeSmartReminder({ organizationId, reminderId: id, userId, snoozedUntil, reason }) })
  } catch (error) {
    return handleApiError(error)
  }
}
