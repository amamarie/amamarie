import { handleApiError, ok } from "@/lib/api-response"
import { buildCabinetAuditReport } from "@/lib/compliance/center"
import { getTenantContext } from "@/lib/tenant"

export async function POST() {
  try {
    const { organizationId, userId } = await getTenantContext()
    return ok(await buildCabinetAuditReport({ organizationId, userId }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
