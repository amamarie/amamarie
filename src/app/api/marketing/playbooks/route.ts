import { handleApiError, ok } from "@/lib/api-response"
import { createMarketingStarterPlaybook } from "@/lib/marketing/automation"
import { assertMarketingPermission } from "@/lib/marketing/permissions"
import { getTenantContext } from "@/lib/tenant"

export async function POST(request: Request) {
  try {
    const { organizationId, userId, role } = await getTenantContext()
    assertMarketingPermission(role, "automation")
    const playbook = await createMarketingStarterPlaybook({
      organizationId,
      userId,
      input: await request.json(),
    })
    return ok(playbook, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
