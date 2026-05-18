import { handleApiError, ok } from "@/lib/api-response"
import { evaluateSmartRemindersForClient } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ clientId: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { clientId } = await params
    const { organizationId, userId } = await getTenantContext()
    return ok(await evaluateSmartRemindersForClient({ organizationId, clientId, userId, request }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
