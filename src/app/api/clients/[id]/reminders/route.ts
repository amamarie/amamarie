import { handleApiError, ok } from "@/lib/api-response"
import { listSmartReminders } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const url = new URL(request.url)
    const status = url.searchParams.get("status") ?? undefined
    return ok({ reminders: await listSmartReminders({ organizationId, clientId: id, status }) })
  } catch (error) {
    return handleApiError(error)
  }
}
