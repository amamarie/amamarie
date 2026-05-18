import { handleApiError, ok } from "@/lib/api-response"
import { recalculateAmlRisk } from "@/lib/aml/service"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const profile = await recalculateAmlRisk({ organizationId, clientId: id, userId, request })
    return ok({ profile })
  } catch (error) {
    return handleApiError(error)
  }
}
