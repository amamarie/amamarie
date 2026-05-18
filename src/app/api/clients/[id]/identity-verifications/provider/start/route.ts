import { handleApiError, ok } from "@/lib/api-response"
import { startProviderIdentityVerification } from "@/lib/aml/idv-provider"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const result = await startProviderIdentityVerification({ organizationId, clientId: id, userId, request })
    return ok(result)
  } catch (error) {
    return handleApiError(error)
  }
}
