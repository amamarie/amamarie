import { handleApiError, ok } from "@/lib/api-response"
import { completeSmartReminder } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    return ok({ reminder: await completeSmartReminder({ organizationId, reminderId: id, userId, note: typeof body.note === "string" ? body.note : undefined }) })
  } catch (error) {
    return handleApiError(error)
  }
}
