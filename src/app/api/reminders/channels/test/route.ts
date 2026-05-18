import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { ForbiddenError } from "@/lib/auth"
import { testSmartReminderExternalChannels } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

const testSchema = z.object({
  channel: z.enum(["SLACK", "TEAMS", "ALL"]).optional(),
})

export async function POST(request: Request) {
  try {
    const { organizationId, userId, role } = await getTenantContext()
    if (role === "DEVELOPER") {
      throw new ForbiddenError("Le rôle développeur ne peut pas déclencher les webhooks externes.")
    }

    const payload = testSchema.parse(await request.json().catch(() => ({})))
    return ok(await testSmartReminderExternalChannels({ organizationId, userId, channel: payload.channel }))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail("INVALID_CHANNEL", "Canal invalide.", 422, error.flatten())
    }
    return handleApiError(error)
  }
}
