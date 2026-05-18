import { fail, handleApiError, ok } from "@/lib/api-response"
import { runDiditAmlScreening } from "@/lib/aml/didit-aml"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const result = await runDiditAmlScreening({
      organizationId,
      clientId: id,
      userId,
      request,
      includeAdverseMedia: Boolean(body.includeAdverseMedia),
      includeOngoingMonitoring: Boolean(body.includeOngoingMonitoring),
    })
    if (!result.providerConfigured) {
      return fail("DIDIT_AML_CONFIGURATION_MISSING", `Configuration Didit AML incomplète : ${(result.missing ?? []).join(", ")}.`, 400)
    }
    return ok(result)
  } catch (error) {
    return handleApiError(error)
  }
}
