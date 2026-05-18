import { handleApiError, ok } from "@/lib/api-response"
import { getMissingDocumentRequirements } from "@/lib/documents/missing-requirements"
import { getTenantContext } from "@/lib/tenant"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const searchParams = new URL(request.url).searchParams
    const clientId = searchParams.get("clientId")
    const limit = Number(searchParams.get("limit") ?? 150)
    const requirements = await getMissingDocumentRequirements({
      organizationId,
      clientId,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 500) : 150,
    })
    return ok({ items: requirements, total: requirements.length })
  } catch (error) {
    return handleApiError(error)
  }
}
