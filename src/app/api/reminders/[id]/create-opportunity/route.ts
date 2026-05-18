import { handleApiError, ok } from "@/lib/api-response"
import { createOpportunityFromSmartReminder } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    return ok(await createOpportunityFromSmartReminder({ organizationId, reminderId: id, userId }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
