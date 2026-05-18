import { fail, handleApiError, ok } from "@/lib/api-response"
import { markRecommendationReviewed } from "@/lib/recommendations/actions"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const recommendation = await markRecommendationReviewed({ id, organizationId, userId })
    return ok(recommendation)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("KYC_RECOMMENDATION_BLOCKED:")) {
      const reason = error.message.split(":").slice(1).join(":") || "Profil client non prêt"
      return fail("KYC_RECOMMENDATION_BLOCKED", `Impossible de valider cette recommandation : ${reason}. Ouvrez le profil client, corrigez le dossier, puis recommencez.`, 409)
    }
    return handleApiError(error)
  }
}
