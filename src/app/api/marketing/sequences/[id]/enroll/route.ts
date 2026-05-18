import { fail, handleApiError, ok } from "@/lib/api-response"
import { enrollMarketingSequenceSegment } from "@/lib/marketing/automation"
import { assertMarketingPermission } from "@/lib/marketing/permissions"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, role } = await getTenantContext()
    assertMarketingPermission(role, "automation")
    const body = await request.json().catch(() => ({}))
    return ok(await enrollMarketingSequenceSegment({
      organizationId,
      input: { ...body, sequenceId: id },
    }))
  } catch (error) {
    if (error instanceof Error && error.message === "MARKETING_SEQUENCE_NOT_FOUND") return fail("NOT_FOUND", "Séquence introuvable.", 404)
    return handleApiError(error)
  }
}
