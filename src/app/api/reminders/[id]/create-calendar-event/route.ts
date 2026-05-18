import { handleApiError, ok } from "@/lib/api-response"
import { createCalendarEventFromSmartReminder } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const startAt = typeof body.startAt === "string" ? new Date(body.startAt) : undefined
    const durationMinutes = typeof body.durationMinutes === "number" ? body.durationMinutes : undefined
    return ok(await createCalendarEventFromSmartReminder({ organizationId, reminderId: id, userId, startAt, durationMinutes }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
