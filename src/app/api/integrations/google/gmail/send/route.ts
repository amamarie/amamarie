import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { sendAdvisorGmailEmail } from "@/lib/google/gmail"
import { assertActivePurposeConsent } from "@/lib/privacy/service"
import { getTenantContext } from "@/lib/tenant"

const sendGmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(180),
  text: z.string().min(1).max(10000),
  html: z.string().max(20000).optional(),
  clientId: z.string().min(1).optional(),
  isMarketing: z.boolean().optional().default(false),
})

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = sendGmailSchema.parse(await request.json())
    if (payload.isMarketing && payload.clientId) {
      await assertActivePurposeConsent({ organizationId, clientId: payload.clientId, purposeCode: "marketing", errorCode: "MARKETING_CONSENT_REQUIRED" })
    }
    const sent = await sendAdvisorGmailEmail({
      organizationId,
      userId,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    })
    if (!sent) return fail("GMAIL_NOT_CONNECTED", "Connectez Gmail avant d’envoyer depuis le compte du conseiller.", 409)
    return ok(sent, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "MARKETING_CONSENT_REQUIRED") return fail("MARKETING_CONSENT_REQUIRED", "Un consentement marketing actif est requis avant d’envoyer une communication commerciale.", 403)
    return handleApiError(error)
  }
}
