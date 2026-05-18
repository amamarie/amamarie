import { fail, handleApiError, ok } from "@/lib/api-response"
import { completeRecommendation } from "@/lib/recommendations/actions"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PATCH(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const recommendation = await completeRecommendation({ id, organizationId, userId })
    return ok(recommendation)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("KYC_RECOMMENDATION_BLOCKED:")) {
      const reason = error.message.split(":").slice(1).join(":") || "Profil client non prêt"
      return fail("KYC_RECOMMENDATION_BLOCKED", `Impossible de compléter cette recommandation : ${reason}. Ouvrez le profil client, corrigez le dossier, puis recommencez.`, 409)
    }
    if (error instanceof Error && error.message === "INSURANCE_ANALYSIS_NOT_FOUND") {
      return fail("INSURANCE_ANALYSIS_NOT_FOUND", "L’analyse des besoins liée à cette recommandation est introuvable.", 404)
    }
    if (error instanceof Error && error.message.startsWith("INSURANCE_ANALYSIS_RECOMMENDATION_BLOCKED:")) {
      const status = error.message.split(":")[1] ?? "UNKNOWN"
      const labels: Record<string, string> = {
        NOT_STARTED: "non commencée",
        DRAFT: "en brouillon",
        MISSING_DATA: "avec des données manquantes",
        IN_ANALYSIS: "en analyse",
        ADVISOR_REVIEW: "en révision conseiller",
        WAITING_CLIENT: "en attente client",
        NEEDS_UPDATE: "à mettre à jour",
      }
      return fail(
        "INSURANCE_ANALYSIS_RECOMMENDATION_BLOCKED",
        `Impossible de compléter cette recommandation : l’analyse des besoins est ${labels[status] ?? status}. Ouvrez l’analyse, corrigez le statut, puis recommencez.`,
        409,
        { status }
      )
    }
    return handleApiError(error)
  }
}
