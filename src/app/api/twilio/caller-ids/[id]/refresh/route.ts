import { handleApiError, ok } from "@/lib/api-response"
import { getTenantContext } from "@/lib/tenant"
import { refreshAdvisorTwilioCallerIdVerification } from "@/lib/twilio/caller-ids"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const { id } = await params
    const callerId = await refreshAdvisorTwilioCallerIdVerification({ organizationId, userId, id })
    return ok(callerId)
  } catch (error) {
    return handleApiError(error)
  }
}
