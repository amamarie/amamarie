import { handleApiError, ok } from "@/lib/api-response"
import { sendSmsFromCrm } from "@/lib/services/communications"
import { getTenantContext } from "@/lib/tenant"
import { smsSendErrorMessage } from "@/lib/twilio/errors"
import { sendSmsSchema } from "@/lib/validations/communications"

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = sendSmsSchema.parse(await request.json())
    const sms = await sendSmsFromCrm({ user: { id: userId, organizationId }, ...payload })
    return ok(sms, { status: 201 })
  } catch (error) {
    if (error instanceof Error && ["RATE_LIMITED", "SMS_CONSENT_REVOKED", "SMS_CONTENT_NOT_ALLOWED", "MARKETING_CONSENT_REQUIRED"].includes(error.message)) {
      return handleApiError(error)
    }
    return Response.json({ error: smsSendErrorMessage(error) }, { status: 400 })
  }
}
