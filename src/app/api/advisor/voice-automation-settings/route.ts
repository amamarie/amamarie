import { z } from "zod"

import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import {
  clampCallDelayMinutes,
  ensureAdvisorVoiceAutomationSettings,
  serializeAdvisorVoiceAutomationSettings,
} from "@/lib/retell/advisor-voice-settings"
import { getTenantContext } from "@/lib/tenant"

const emptyToNull = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}, z.string().nullable())

const settingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  greetingMessage: z.string().trim().min(20).max(1000).optional(),
  smsNotice: z.string().trim().min(20).max(500).optional(),
  tone: z.string().trim().min(2).max(80).optional(),
  language: z.enum(["fr-CA", "fr-FR", "en-CA", "en-US"]).optional(),
  callDelayMinutes: z.coerce.number().min(0).max(60).optional(),
  availabilityPreference: z.string().trim().min(2).max(160).optional(),
  qualificationType: z.string().trim().min(2).max(120).optional(),
  bookingLink: emptyToNull.optional(),
  specialties: emptyToNull.optional(),
  customInstructions: emptyToNull.optional(),
})

export async function GET() {
  try {
    const { organizationId, userId } = await getTenantContext()
    const settings = await ensureAdvisorVoiceAutomationSettings({ organizationId, userId })
    return ok(serializeAdvisorVoiceAutomationSettings(settings))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    await ensureAdvisorVoiceAutomationSettings({ organizationId, userId })
    const payload = settingsSchema.parse(await request.json())

    const settings = await prisma.advisorVoiceAutomationSettings.update({
      where: { organizationId_userId: { organizationId, userId } },
      data: {
        isEnabled: payload.isEnabled,
        greetingMessage: payload.greetingMessage,
        smsNotice: payload.smsNotice,
        tone: payload.tone,
        language: payload.language,
        callDelayMinutes: payload.callDelayMinutes === undefined ? undefined : clampCallDelayMinutes(payload.callDelayMinutes),
        availabilityPreference: payload.availabilityPreference,
        qualificationType: payload.qualificationType,
        bookingLink: payload.bookingLink,
        specialties: payload.specialties,
        customInstructions: payload.customInstructions,
      },
    })

    return ok(serializeAdvisorVoiceAutomationSettings(settings))
  } catch (error) {
    return handleApiError(error)
  }
}
