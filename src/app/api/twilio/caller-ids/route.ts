import { z } from "zod"

import { handleApiError, ok } from "@/lib/api-response"
import { listAdvisorTwilioCallerIds, startAdvisorTwilioCallerIdVerification } from "@/lib/twilio/caller-ids"
import { getTenantContext } from "@/lib/tenant"

const callerIdSchema = z.object({
  phoneNumber: z.string().trim().min(8, "Le numéro personnel du conseiller est requis.").max(32),
  friendlyName: z.string().trim().max(120).optional().nullable(),
})

export async function GET() {
  try {
    const { organizationId, userId } = await getTenantContext()
    const callerIds = await listAdvisorTwilioCallerIds({ organizationId, userId })
    return ok(callerIds)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = callerIdSchema.parse(await request.json())
    const callerId = await startAdvisorTwilioCallerIdVerification({
      organizationId,
      userId,
      phoneNumber: payload.phoneNumber,
      friendlyName: payload.friendlyName,
    })
    return ok(callerId)
  } catch (error) {
    return handleApiError(error)
  }
}
