import { prisma } from "@/lib/prisma"
import { getAppUrl, sendTwilioSms } from "@/lib/twilio/messaging"
import { normalizePhoneNumber } from "@/lib/twilio/phone"
import { assertAdministrativeSms } from "@/lib/twilio/templates"

type TwilioSettings = {
  twilioAccountSid?: string | null
  twilioAuthToken?: string | null
  twilioPhoneNumber?: string | null
  autoReplyEnabled?: boolean | null
}

function twilioCredentials(settings?: TwilioSettings | null) {
  return settings?.twilioAccountSid && settings.twilioAuthToken
    ? { accountSid: settings.twilioAccountSid, authToken: settings.twilioAuthToken }
    : undefined
}

export async function sendAutomatedSms({
  organizationId,
  advisorId,
  leadId,
  clientId,
  to,
  body,
  requireAutoReplyEnabled = true,
}: {
  organizationId: string
  advisorId?: string | null
  leadId?: string | null
  clientId?: string | null
  to?: string | null
  body: string
  requireAutoReplyEnabled?: boolean
}) {
  assertAdministrativeSms(body)
  const settings = await prisma.organizationCommunicationSettings.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      twilioPhoneNumber: normalizePhoneNumber(process.env.TWILIO_PHONE_NUMBER),
    },
  })
  const fromNumber = normalizePhoneNumber(settings.twilioPhoneNumber ?? process.env.TWILIO_PHONE_NUMBER)
  const toNumber = normalizePhoneNumber(to)
  if ((requireAutoReplyEnabled && !settings.autoReplyEnabled) || !fromNumber || !toNumber) return null

  try {
    const sent = await sendTwilioSms({
      to: toNumber,
      from: fromNumber,
      body,
      statusCallback: getAppUrl() ? `${getAppUrl()}/api/webhooks/twilio/sms-status` : undefined,
      credentials: twilioCredentials(settings),
    })
    return prisma.sMSMessage.create({
      data: {
        organizationId,
        leadId,
        clientId,
        advisorId,
        direction: "OUTBOUND",
        status: "QUEUED",
        fromNumber,
        toNumber,
        phoneNumber: toNumber,
        body,
        twilioMessageSid: sent.sid,
      },
    })
  } catch (error) {
    await prisma.sMSMessage.create({
      data: {
        organizationId,
        leadId,
        clientId,
        advisorId,
        direction: "OUTBOUND",
        status: "FAILED",
        fromNumber,
        toNumber,
        phoneNumber: toNumber,
        body,
        errorMessage: error instanceof Error ? error.message.slice(0, 240) : "Erreur Twilio",
      },
    })
    throw error
  }
}
