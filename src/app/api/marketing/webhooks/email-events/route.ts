import { fail, handleApiError, ok } from "@/lib/api-response"
import { applyMarketingEmailEvent } from "@/lib/marketing/automation"

export async function POST(request: Request) {
  try {
    const expectedSecret = process.env.MARKETING_WEBHOOK_SECRET
    if (!expectedSecret && process.env.NODE_ENV === "production") {
      return fail("CONFIGURATION_REQUIRED", "Secret webhook marketing manquant.", 500)
    }
    if (expectedSecret && request.headers.get("x-marketing-webhook-secret") !== expectedSecret) {
      return fail("UNAUTHORIZED", "Webhook marketing non autorisé.", 401)
    }

    const result = await applyMarketingEmailEvent({ input: await request.json() })
    return ok(result)
  } catch (error) {
    if (error instanceof Error && error.message === "MARKETING_SEND_NOT_FOUND") {
      return fail("NOT_FOUND", "Envoi marketing introuvable.", 404)
    }
    return handleApiError(error)
  }
}
