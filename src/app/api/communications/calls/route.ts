import { handleApiError, ok } from "@/lib/api-response"
import { getCalls } from "@/lib/services/communications"
import { getTenantContext } from "@/lib/tenant"
import { communicationsQuerySchema } from "@/lib/validations/communications"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const query = communicationsQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    return ok(await getCalls({ organizationId, query }))
  } catch (error) {
    return handleApiError(error)
  }
}
