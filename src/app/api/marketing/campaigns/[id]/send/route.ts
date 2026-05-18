import { fail, handleApiError, ok } from "@/lib/api-response"
import { sendMarketingCampaign } from "@/lib/marketing/automation"
import { assertMarketingPermission } from "@/lib/marketing/permissions"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId, role } = await getTenantContext()
    assertMarketingPermission(role, "send")
    return ok(await sendMarketingCampaign({ organizationId, userId, campaignId: id }))
  } catch (error) {
    if (error instanceof Error && error.message === "MARKETING_CAMPAIGN_NOT_FOUND") return fail("NOT_FOUND", "Campagne introuvable.", 404)
    if (error instanceof Error && error.message === "MARKETING_VALIDATION_REQUIRED") return fail("VALIDATION_REQUIRED", "Cette campagne doit être validée avant envoi.", 409)
    return handleApiError(error)
  }
}
