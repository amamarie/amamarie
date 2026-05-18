import { ok, handleApiError } from "@/lib/api-response"
import { getIdvProviderStatus } from "@/lib/aml/idv-provider"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    await getTenantContext()
    return ok({ status: getIdvProviderStatus() })
  } catch (error) {
    return handleApiError(error)
  }
}
