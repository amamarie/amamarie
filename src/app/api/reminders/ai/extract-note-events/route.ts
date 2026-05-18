import { handleApiError, ok } from "@/lib/api-response"
import { extractNoteEventsForSmartReminders } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const clientId = typeof body.clientId === "string" ? body.clientId : undefined
    return ok(await extractNoteEventsForSmartReminders({ organizationId, userId, clientId }))
  } catch (error) {
    return handleApiError(error)
  }
}
