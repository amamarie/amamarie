import { fail, handleApiError, ok } from "@/lib/api-response"
import { approveMarketingCampaign } from "@/lib/marketing/automation"
import { assertMarketingPermission } from "@/lib/marketing/permissions"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId, role } = await getTenantContext()
    assertMarketingPermission(role, "approve")
    return ok(await approveMarketingCampaign({ organizationId, userId, role, campaignId: id }))
  } catch (error) {
    if (error instanceof Error && error.message === "MARKETING_CAMPAIGN_NOT_FOUND") return fail("NOT_FOUND", "Campagne introuvable.", 404)
    if (error instanceof Error && error.message === "MARKETING_APPROVAL_FORBIDDEN") return fail("FORBIDDEN", "Seul un owner, développeur ou responsable conformité peut valider une campagne.", 403)
    if (error instanceof Error && error.message === "MARKETING_RISKY_TERMS") return fail("VALIDATION_ERROR", "La campagne contient encore des termes sensibles. Modifiez le contenu avant validation.", 422)
    return handleApiError(error)
  }
}
