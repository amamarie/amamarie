import { handleApiError, ok } from "@/lib/api-response"
import { createMarketingSegment, getMarketingOverview } from "@/lib/marketing/automation"
import { assertMarketingPermission } from "@/lib/marketing/permissions"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId, role } = await getTenantContext()
    assertMarketingPermission(role, "view")
    const overview = await getMarketingOverview({ organizationId })
    return ok(overview.segments)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, role } = await getTenantContext()
    assertMarketingPermission(role, "draft")
    return ok(await createMarketingSegment({ organizationId, input: await request.json() }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
