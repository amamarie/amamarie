import { fail, ok } from "@/lib/api-response"
import { assertRateLimit, rateLimitKey } from "@/lib/security/rate-limit"
import { submitPublicLeadForm } from "@/lib/services/lead-forms"
import { formatValidationError } from "@/lib/validation-error"

type RouteContext = {
  params: Promise<{ slug: string }>
}

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { slug } = await params
    assertRateLimit({ key: rateLimitKey(["public_lead_form", slug, clientIp(request) ?? "unknown"]), limit: 8, windowMs: 60_000 })
    const result = await submitPublicLeadForm({
      slug,
      input: await request.json(),
      sourceUrl: request.headers.get("referer"),
      ipAddress: clientIp(request),
      userAgent: request.headers.get("user-agent"),
    })
    return ok({ message: result.message, leadId: result.lead.id }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "LEAD_FORM_NOT_FOUND") {
      return fail("NOT_FOUND", "Ce formulaire n’est pas disponible.", 404)
    }
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return fail("RATE_LIMITED", "Trop de soumissions. Réessayez dans une minute.", 429)
    }
    return fail("VALIDATION_ERROR", formatValidationError(error, "Impossible d’envoyer le formulaire."), 400)
  }
}
