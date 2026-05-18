import { handleApiError, ok } from "@/lib/api-response"
import { ignoreSmartReminder } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    return ok({ reminder: await ignoreSmartReminder({ organizationId, reminderId: id, userId, reason: typeof body.reason === "string" ? body.reason : "" }) })
  } catch (error) {
    return handleApiError(error)
  }
}
