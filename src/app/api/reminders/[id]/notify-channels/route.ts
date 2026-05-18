import { handleApiError, ok } from "@/lib/api-response"
import { ForbiddenError } from "@/lib/auth"
import { notifyExternalChannelsFromSmartReminder } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId, role } = await getTenantContext()
    if (role === "DEVELOPER") {
      throw new ForbiddenError("Le rôle développeur ne peut pas déclencher les webhooks externes.")
    }
    return ok(await notifyExternalChannelsFromSmartReminder({ organizationId, reminderId: id, userId }))
  } catch (error) {
    return handleApiError(error)
  }
}
