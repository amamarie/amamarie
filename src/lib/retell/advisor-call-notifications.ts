import { z } from "zod"

import { runAI } from "@/lib/ai/core/run-ai"
import { isResendConfigured, sendTransactionalEmail } from "@/lib/email/send"
import { sendAdvisorGmailEmail } from "@/lib/google/gmail"
import { prisma } from "@/lib/prisma"
import { ensureCommunicationSettings } from "@/lib/services/communications"
import { sendTwilioSms } from "@/lib/twilio/messaging"
import { normalizePhoneNumber } from "@/lib/twilio/phone"
import { assertAdministrativeSms } from "@/lib/twilio/templates"

const advisorBriefSchema = z.object({
  title: z.string().max(120),
  brief: z.string().max(900),
  urgency: z.string().max(40),
  nextAction: z.string().max(240),
  sms: z.string().max(320),
})

function appUrl(path?: string | null) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? process.env.APP_URL?.replace(/\/$/, "") ?? ""
  if (!base || !path) return path ?? ""
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

function twilioCredentials(settings: { twilioAccountSid?: string | null; twilioAuthToken?: string | null }) {
  return settings.twilioAccountSid && settings.twilioAuthToken
    ? { accountSid: settings.twilioAccountSid, authToken: settings.twilioAuthToken }
    : undefined
}

function truncateSms(input: string) {
  return input.replace(/\s+/g, " ").trim().slice(0, 320)
}

export async function generateAdvisorCallBrief({
  organizationId,
  advisorId,
  callerName,
  callerPhone,
  summary,
  transcript,
  nextAction,
  urgency,
  actionUrl,
}: {
  organizationId: string
  advisorId: string
  callerName: string
  callerPhone?: string | null
  summary?: string | null
  transcript?: string | null
  nextAction?: string | null
  urgency?: string | null
  actionUrl?: string | null
}) {
  const fallback = {
    title: "Nouvel appel conseiller",
    brief: summary?.trim() || `Nouvel appel de ${callerName}${callerPhone ? ` (${callerPhone})` : ""}.`,
    urgency: urgency || "normale",
    nextAction: nextAction?.trim() || "Ouvrir le dossier et rappeler le client si nécessaire.",
    sms: truncateSms(`FinAssuro: appel de ${callerName}. ${nextAction || "Ouvrir le dossier."} ${appUrl(actionUrl)}`),
  }

  return runAI({
    organizationId,
    userId: advisorId,
    feature: "retell_advisor_call_brief",
    schema: advisorBriefSchema,
    fallback: () => fallback,
    system: "Tu prépares une alerte interne pour un conseiller en assurance. Ne donne aucun conseil financier, fiscal, juridique ou d'assurance. Résume seulement les faits de l'appel, l'urgence et la prochaine action. Réponds seulement en JSON.",
    prompt: "Crée un court résumé opérationnel pour avertir le conseiller par Gmail et SMS.",
    context: {
      callerName,
      callerPhone,
      summary,
      transcript: transcript?.slice(0, 6000),
      nextAction,
      urgency,
      actionUrl: appUrl(actionUrl),
    },
  }).catch(() => fallback)
}

export async function sendAdvisorCallEmailAndSms({
  organizationId,
  advisorId,
  leadId,
  clientId,
  toEmail,
  subject,
  text,
  smsBody,
}: {
  organizationId: string
  advisorId?: string | null
  leadId?: string | null
  clientId?: string | null
  toEmail?: string | null
  subject: string
  text: string
  smsBody?: string | null
}) {
  if (!advisorId) return { email: null, sms: null }

  const advisor = await prisma.user.findFirst({
    where: { id: advisorId, organizationId },
    select: { email: true, phone: true },
  })
  const email = toEmail?.trim() || advisor?.email || null
  let emailResult: unknown = null

  if (email) {
    const gmail = await sendAdvisorGmailEmail({ organizationId, userId: advisorId, to: email, subject, text }).catch(() => null)
    emailResult = gmail
    if (!gmail && isResendConfigured()) {
      emailResult = await sendTransactionalEmail({ to: email, subject, text }).catch(() => null)
    }
  }

  const settings = await ensureCommunicationSettings(organizationId)
  const from = normalizePhoneNumber(settings.twilioPhoneNumber ?? process.env.TWILIO_PHONE_NUMBER)
  const to = normalizePhoneNumber(settings.advisorSmsNotificationNumber ?? advisor?.phone)
  const body = smsBody ? truncateSms(smsBody) : null
  let smsResult: unknown = null

  if (from && to && from !== to && body) {
    assertAdministrativeSms(body)
    try {
      const sent = await sendTwilioSms({
        from,
        to,
        body,
        credentials: twilioCredentials(settings),
      })
      smsResult = await prisma.sMSMessage.create({
        data: {
          organizationId,
          advisorId,
          leadId: leadId ?? undefined,
          clientId: clientId ?? undefined,
          direction: "OUTBOUND",
          status: "QUEUED",
          fromNumber: from,
          toNumber: to,
          phoneNumber: to,
          body,
          twilioMessageSid: sent.sid,
        },
      })
    } catch (error) {
      smsResult = await prisma.sMSMessage.create({
        data: {
          organizationId,
          advisorId,
          leadId: leadId ?? undefined,
          clientId: clientId ?? undefined,
          direction: "OUTBOUND",
          status: "FAILED",
          fromNumber: from,
          toNumber: to,
          phoneNumber: to,
          body,
          errorMessage: error instanceof Error ? error.message.slice(0, 240) : "Erreur Twilio",
        },
      })
    }
  }

  return { email: emailResult, sms: smsResult }
}
