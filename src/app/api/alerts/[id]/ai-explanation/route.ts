import { fail, handleApiError, ok } from "@/lib/api-response"
import { getLatestAlertAiExplanation } from "@/lib/ai/alert-explanations/actions"
import { AiRateLimitError, generateAlertAiExplanation } from "@/lib/ai/alert-explanations/engine"
import { prisma } from "@/lib/prisma"
import { assertActiveAiConsent } from "@/lib/privacy/service"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    return ok(await getLatestAlertAiExplanation({ organizationId, alertId: id }))
  } catch (error) {
    if (error instanceof Error && error.message === "AI_EXPLANATION_NOT_FOUND") {
      return fail("NOT_FOUND", "Aucune explication IA n’a encore été générée pour cette alerte.", 404)
    }
    return handleApiError(error)
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const alert = await prisma.complianceAlert.findFirst({ where: { id, organizationId }, select: { clientId: true } })
    if (!alert) {
      return fail("NOT_FOUND", "Alerte introuvable.", 404)
    }
    await assertActiveAiConsent({ organizationId, clientId: alert.clientId })
    return ok(await generateAlertAiExplanation({ organizationId, alertId: id, userId }), { status: 201 })
  } catch (error) {
    if (error instanceof AiRateLimitError) {
      return fail("RATE_LIMIT", error.message, 429)
    }
    if (error instanceof Error && error.message === "AI_CONSENT_REQUIRED") {
      return fail("AI_CONSENT_REQUIRED", "Le consentement d’assistance technologique / IA doit être actif avant de générer une explication d’alerte.", 403)
    }
    if (error instanceof Error && error.message === "ALERT_NOT_FOUND") {
      return fail("NOT_FOUND", "Alerte introuvable.", 404)
    }
    return handleApiError(error)
  }
}
