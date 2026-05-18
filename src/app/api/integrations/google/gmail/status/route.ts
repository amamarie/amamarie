import { handleApiError, ok } from "@/lib/api-response"
import { getGmailConnectionStatus, isGoogleGmailConfigured } from "@/lib/google/gmail"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId, userId, role } = await getTenantContext()
    const status = await getGmailConnectionStatus({ organizationId, userId })
    return ok({ ...status, configured: isGoogleGmailConfigured(), roleBlocked: role === "DEVELOPER" })
  } catch (error) {
    return handleApiError(error)
  }
}
