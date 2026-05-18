import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { ensureCommunicationSettings } from "@/lib/services/communications"
import { getTenantContext } from "@/lib/tenant"
import { normalizePhoneNumber } from "@/lib/twilio/phone"
import { communicationSettingsSchema } from "@/lib/validations/communications"

function sanitizeSettings<T extends { twilioAuthToken?: string | null }>(settings: T) {
  return {
    ...settings,
    twilioAuthToken: settings.twilioAuthToken ? "CONFIGURED" : null,
  }
}

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    return ok(sanitizeSettings(await ensureCommunicationSettings(organizationId)))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const payload = communicationSettingsSchema.parse(await request.json())
    if (payload.defaultAdvisorId) {
      await prisma.user.findFirstOrThrow({ where: { id: payload.defaultAdvisorId, organizationId }, select: { id: true } })
    }
    const normalizedPhoneNumber = payload.twilioPhoneNumber === undefined
      ? undefined
      : normalizePhoneNumber(payload.twilioPhoneNumber)
    const normalizedAdvisorSmsNotificationNumber = payload.advisorSmsNotificationNumber === undefined
      ? undefined
      : normalizePhoneNumber(payload.advisorSmsNotificationNumber)
    const twilioAuthToken = payload.twilioAuthToken?.trim()
    const updatePayload = {
      ...payload,
      ...(normalizedPhoneNumber !== undefined ? { twilioPhoneNumber: normalizedPhoneNumber } : {}),
      ...(normalizedAdvisorSmsNotificationNumber !== undefined ? { advisorSmsNotificationNumber: normalizedAdvisorSmsNotificationNumber } : {}),
      ...(twilioAuthToken && twilioAuthToken !== "CONFIGURED" ? { twilioAuthToken } : {}),
    }
    if (!twilioAuthToken || twilioAuthToken === "CONFIGURED") {
      delete updatePayload.twilioAuthToken
    }

    const settings = await prisma.organizationCommunicationSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        ...updatePayload,
        twilioPhoneNumber: normalizedPhoneNumber,
        advisorSmsNotificationNumber: normalizedAdvisorSmsNotificationNumber,
      },
      update: updatePayload,
    })
    return ok(sanitizeSettings(settings))
  } catch (error) {
    return handleApiError(error)
  }
}
