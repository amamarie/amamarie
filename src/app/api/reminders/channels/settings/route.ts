import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { ForbiddenError } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ensureCommunicationSettings } from "@/lib/services/communications"
import { getTenantContext } from "@/lib/tenant"

const webhookSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => value === "" || value === "CONFIGURED" || value.startsWith("https://"), "Le webhook doit commencer par https://.")
  .optional()
  .nullable()

const channelSettingsSchema = z.object({
  slackWebhookUrl: webhookSchema,
  teamsWebhookUrl: webhookSchema,
  externalAutoNotify: z.coerce.boolean().optional(),
  externalNotifyMinPriority: z.enum(["HIGH", "CRITICAL"]).optional(),
})

function redact(value?: string | null) {
  return value ? "CONFIGURED" : null
}

function sanitize(
  settings: {
    smartRemindersSlackWebhookUrl?: string | null
    smartRemindersTeamsWebhookUrl?: string | null
    smartRemindersExternalAutoNotify?: boolean
    smartRemindersExternalNotifyMinPriority?: string
  },
  roleBlocked = false
) {
  return {
    slackWebhookUrl: redact(settings.smartRemindersSlackWebhookUrl),
    teamsWebhookUrl: redact(settings.smartRemindersTeamsWebhookUrl),
    slackConfigured: Boolean(settings.smartRemindersSlackWebhookUrl || process.env.SMART_REMINDERS_SLACK_WEBHOOK_URL),
    teamsConfigured: Boolean(settings.smartRemindersTeamsWebhookUrl || process.env.SMART_REMINDERS_TEAMS_WEBHOOK_URL),
    envFallback: {
      slack: Boolean(process.env.SMART_REMINDERS_SLACK_WEBHOOK_URL),
      teams: Boolean(process.env.SMART_REMINDERS_TEAMS_WEBHOOK_URL),
    },
    externalAutoNotify: Boolean(settings.smartRemindersExternalAutoNotify),
    externalNotifyMinPriority: settings.smartRemindersExternalNotifyMinPriority ?? "CRITICAL",
    roleBlocked,
  }
}

export async function GET() {
  try {
    const { organizationId, role } = await getTenantContext()
    const settings = await ensureCommunicationSettings(organizationId)
    return ok(sanitize(settings, role === "DEVELOPER"))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const { organizationId, role } = await getTenantContext()
    if (role === "DEVELOPER") {
      throw new ForbiddenError("Le rôle développeur ne peut pas configurer les webhooks externes.")
    }

    const payload = channelSettingsSchema.parse(await request.json())
    const updatePayload: {
      smartRemindersSlackWebhookUrl?: string | null
      smartRemindersTeamsWebhookUrl?: string | null
      smartRemindersExternalAutoNotify?: boolean
      smartRemindersExternalNotifyMinPriority?: string
    } = {}

    if (payload.slackWebhookUrl !== undefined) {
      updatePayload.smartRemindersSlackWebhookUrl =
        payload.slackWebhookUrl && payload.slackWebhookUrl !== "CONFIGURED" ? payload.slackWebhookUrl : payload.slackWebhookUrl === null ? null : undefined
    }
    if (payload.teamsWebhookUrl !== undefined) {
      updatePayload.smartRemindersTeamsWebhookUrl =
        payload.teamsWebhookUrl && payload.teamsWebhookUrl !== "CONFIGURED" ? payload.teamsWebhookUrl : payload.teamsWebhookUrl === null ? null : undefined
    }
    if (payload.externalAutoNotify !== undefined) {
      updatePayload.smartRemindersExternalAutoNotify = payload.externalAutoNotify
    }
    if (payload.externalNotifyMinPriority !== undefined) {
      updatePayload.smartRemindersExternalNotifyMinPriority = payload.externalNotifyMinPriority
    }

    if (!Object.keys(updatePayload).length) {
      const settings = await ensureCommunicationSettings(organizationId)
      return ok(sanitize(settings))
    }

    const settings = await prisma.organizationCommunicationSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        ...updatePayload,
      },
      update: updatePayload,
    })

    return ok(sanitize(settings))
  } catch (error) {
    if (error instanceof z.ZodError) {
      return fail("INVALID_WEBHOOK_URL", "URL webhook invalide. Utilisez une URL HTTPS Slack ou Teams.", 422, error.flatten())
    }
    return handleApiError(error)
  }
}
