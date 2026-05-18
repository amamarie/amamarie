import { fail, handleApiError, ok } from "@/lib/api-response"
import { disconnectGoogleGmail } from "@/lib/google/gmail"
import { getTenantContext } from "@/lib/tenant"

export async function POST() {
  try {
    const { organizationId, userId, role } = await getTenantContext()
    if (role === "DEVELOPER") return fail("FORBIDDEN_GOOGLE_WORKSPACE_DEVELOPER", "Le rôle développeur ne peut pas gérer Google Workspace.", 403)
    await disconnectGoogleGmail({ organizationId, userId })
    return ok({ disconnected: true })
  } catch (error) {
    return handleApiError(error)
  }
}
