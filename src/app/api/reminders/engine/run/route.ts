import { handleApiError, ok } from "@/lib/api-response"
import { runSmartReminderEngine } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const clientId = typeof body.clientId === "string" ? body.clientId : undefined
    return ok(await runSmartReminderEngine({ organizationId, userId, request, clientId }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
