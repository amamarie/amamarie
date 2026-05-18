import { fail, handleApiError, ok } from "@/lib/api-response"
import { applyProviderIdentityVerificationWebhook, verifyIdvWebhookSignature } from "@/lib/aml/idv-provider"

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    if (!verifyIdvWebhookSignature(request, rawBody)) {
      return fail("INVALID_SIGNATURE", "Signature webhook IDV invalide.", 401)
    }
    const payload = JSON.parse(rawBody) as Record<string, unknown>
    const record = await applyProviderIdentityVerificationWebhook({ payload, request })
    return ok({ record })
  } catch (error) {
    return handleApiError(error)
  }
}
