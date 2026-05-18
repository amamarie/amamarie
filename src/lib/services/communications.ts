import type { CallStatus, CommunicationDirection, CommunicationStatus, Prisma } from "@prisma/client"

import { runFinassuroBookingAssistant } from "@/lib/booking-assistant/finassuro-booking-assistant"
import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { assertActivePurposeConsent } from "@/lib/privacy/service"
import { assertRateLimit, rateLimitKey } from "@/lib/security/rate-limit"
import { createNotification } from "@/lib/services/notifications"
import { runLeadIntakeAutomation } from "@/lib/services/lead-intake-automation"
import { createTask } from "@/lib/services/tasks"
import { ensureCallTranscription, transcribeCall } from "@/lib/transcription/processor"
import { findOrganizationByTwilioNumber, findPersonByPhone } from "@/lib/twilio/matching"
import { getAppUrl, sendTwilioSms } from "@/lib/twilio/messaging"
import { normalizePhoneNumber } from "@/lib/twilio/phone"
import { assertAdministrativeSms, renderSmsTemplate } from "@/lib/twilio/templates"

type CurrentUser = { id: string; organizationId: string }

function callStatusFromTwilio(status?: string | null): CallStatus {
  switch ((status ?? "").toLowerCase()) {
    case "ringing":
      return "RINGING"
    case "in-progress":
      return "IN_PROGRESS"
    case "completed":
      return "COMPLETED"
    case "busy":
      return "BUSY"
    case "no-answer":
      return "NO_ANSWER"
    case "failed":
      return "FAILED"
    case "canceled":
      return "MISSED"
    default:
      return "RINGING"
  }
}

function smsStatusFromTwilio(status?: string | null): CommunicationStatus {
  switch ((status ?? "").toLowerCase()) {
    case "sent":
      return "SENT"
    case "queued":
      return "QUEUED"
    case "delivered":
      return "DELIVERED"
    case "undelivered":
      return "UNDELIVERED"
    case "failed":
      return "FAILED"
    case "received":
      return "RECEIVED"
    default:
      return "QUEUED"
  }
}

async function getAdvisorForOrganization(organizationId: string, preferredAdvisorId?: string | null) {
  if (preferredAdvisorId) {
    const advisor = await prisma.user.findFirst({ where: { id: preferredAdvisorId, organizationId }, select: { id: true } })
    if (advisor) return advisor.id
  }
  const owner = await prisma.user.findFirst({ where: { organizationId, role: "OWNER" }, select: { id: true } })
  if (owner) return owner.id
  const user = await prisma.user.findFirst({ where: { organizationId }, select: { id: true } })
  return user?.id ?? null
}

async function createLeadFromCommunication({ organizationId, advisorId, phone, source }: { organizationId: string; advisorId?: string | null; phone: string; source: "INBOUND_CALL" | "SMS" }) {
  const normalized = normalizePhoneNumber(phone)
  return prisma.lead.create({
    data: {
      organizationId,
      advisorId: advisorId ?? undefined,
      firstName: "Nouveau",
      lastName: source === "INBOUND_CALL" ? "prospect appelant" : "prospect SMS",
      phone: normalized,
      source,
      status: "NEW",
      priority: "HIGH",
      nextAction: source === "INBOUND_CALL" ? "Rappeler le nouveau prospect" : "Répondre au nouveau message",
    },
  })
}

async function createFollowUpForCommunication({ organizationId, userId, advisorId, leadId, clientId, title, type }: { organizationId: string; userId: string; advisorId?: string | null; leadId?: string | null; clientId?: string | null; title: string; type: "CALL" | "SMS" }) {
  return createTask({
    organizationId,
    userId,
    data: {
      title,
      type,
      status: "TODO",
      priority: "HIGH",
      dueDate: new Date(),
      assignedToId: advisorId ?? userId,
      leadId: leadId ?? undefined,
      clientId: clientId ?? undefined,
      isAutomated: true,
    },
  })
}

async function notifyAdvisor({ organizationId, advisorId, type, title, message, actionUrl, leadId, clientId }: { organizationId: string; advisorId?: string | null; type: "CALL_RECEIVED" | "CALL_MISSED" | "SMS_RECEIVED" | "SMS_FAILED" | "NEW_LEAD_FROM_CALL" | "NEW_LEAD_FROM_SMS"; title: string; message: string; actionUrl?: string; leadId?: string | null; clientId?: string | null }) {
  await createNotification({
    organizationId,
    userId: advisorId ?? null,
    type,
    priority: type === "CALL_MISSED" || type === "SMS_FAILED" ? "HIGH" : "NORMAL",
    title,
    message,
    actionLabel: actionUrl ? "Ouvrir" : undefined,
    actionUrl,
    entityType: leadId ? "Lead" : clientId ? "Client" : undefined,
    entityId: leadId ?? clientId ?? undefined,
    leadId: leadId ?? undefined,
    clientId: clientId ?? undefined,
  })
}

export async function ensureCommunicationSettings(organizationId: string) {
  return prisma.organizationCommunicationSettings.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      twilioPhoneNumber: normalizePhoneNumber(process.env.TWILIO_PHONE_NUMBER),
    },
  })
}

type CommunicationSettingsForTwilio = {
  twilioAccountSid?: string | null
  twilioAuthToken?: string | null
  twilioPhoneNumber?: string | null
  advisorSmsNotificationNumber?: string | null
}

function twilioCredentials(settings?: CommunicationSettingsForTwilio | null) {
  return settings?.twilioAccountSid && settings.twilioAuthToken
    ? { accountSid: settings.twilioAccountSid, authToken: settings.twilioAuthToken }
    : undefined
}

export async function handleIncomingCall({
  from,
  to,
  callSid,
  callStatus,
  createImmediateFollowUp = true,
  sendInitialAutoReply = true,
}: {
  from: string
  to: string
  callSid: string
  callStatus?: string
  createImmediateFollowUp?: boolean
  sendInitialAutoReply?: boolean
}) {
  const orgMatch = await findOrganizationByTwilioNumber(to)
  if (!orgMatch) throw new Error("TWILIO_ORGANIZATION_NOT_FOUND")
  const { organizationId } = orgMatch
  const settings = orgMatch.settings ?? await ensureCommunicationSettings(organizationId)
  const fromNumber = normalizePhoneNumber(from)
  const toNumber = normalizePhoneNumber(to)
  const match = await findPersonByPhone({ organizationId, phoneNumber: fromNumber })
  const advisorId = await getAdvisorForOrganization(organizationId, match.advisorId ?? settings.defaultAdvisorId)
  let leadId = match.type === "LEAD" ? match.id : null
  const clientId = match.type === "CLIENT" ? match.id : null
  let createdLeadFromCall = false

  if (!match.id && settings.inboundCallAutoCreateLead) {
    const lead = await createLeadFromCommunication({ organizationId, advisorId, phone: fromNumber, source: "INBOUND_CALL" })
    leadId = lead.id
    createdLeadFromCall = true
    await createCrmActivity({ organizationId, userId: null, leadId, type: "LEAD_CREATED", title: "Prospect créé depuis appel entrant", description: fromNumber, source: "WEBHOOK" })
    await notifyAdvisor({ organizationId, advisorId, type: "NEW_LEAD_FROM_CALL", title: "Nouveau prospect depuis appel", message: `Un appel entrant inconnu a créé un prospect: ${fromNumber}.`, actionUrl: `/prospects/${leadId}`, leadId })
    await runAutomationsForEvent({ organizationId, userId: null, leadId, event: "LEAD_CREATED", title: "Prospect créé depuis appel entrant", description: fromNumber, payload: { source: "INBOUND_CALL", phone: fromNumber, firstName: lead.firstName, lastName: lead.lastName, fullName: `${lead.firstName} ${lead.lastName}`, advisorId } })
  }

  const call = await prisma.callLog.upsert({
    where: { twilioCallSid: callSid },
    update: { status: callStatusFromTwilio(callStatus), leadId, clientId, advisorId },
    create: {
      organizationId,
      leadId,
      clientId,
      advisorId,
      direction: "INBOUND",
      status: callStatusFromTwilio(callStatus),
      fromNumber,
      toNumber,
      phoneNumber: fromNumber,
      twilioCallSid: callSid,
      matchedEntityType: match.type,
      matchedEntityId: match.id,
    },
  })

  await createCrmActivity({ organizationId, userId: null, leadId, clientId, type: "CALL_RECEIVED", title: "Appel reçu", description: fromNumber, source: "WEBHOOK", entityType: "CallLog", entityId: call.id })
  await notifyAdvisor({ organizationId, advisorId, type: "CALL_RECEIVED", title: "Nouvel appel reçu", message: `${match.displayName ?? fromNumber} a appelé.`, actionUrl: leadId ? `/prospects/${leadId}` : clientId ? `/clients/${clientId}` : "/communications", leadId, clientId })
  const intake = leadId
    ? await runLeadIntakeAutomation({
        organizationId,
        advisorId,
        leadId,
        source: "INBOUND_CALL",
        message: `Appel entrant de ${fromNumber}`,
        phone: fromNumber,
        createFollowUpTasks: createdLeadFromCall || createImmediateFollowUp,
        extraContext: { callId: call.id, callSid },
      })
    : null

  if (!intake && createImmediateFollowUp) {
    await createFollowUpForCommunication({ organizationId, userId: advisorId ?? "", advisorId, leadId, clientId, title: leadId ? "Rappeler nouveau prospect" : "Rappeler le client", type: "CALL" })
  }

  if (createdLeadFromCall && intake?.clientSmsBody && settings.autoReplyEnabled && settings.twilioPhoneNumber) {
    await sendAutoSms({ organizationId, advisorId, leadId, clientId, to: fromNumber, from: settings.twilioPhoneNumber, body: intake.clientSmsBody })
  } else if (sendInitialAutoReply && !match.id && settings.autoReplyEnabled && settings.twilioPhoneNumber) {
    const body = renderSmsTemplate("AUTO_REPLY_INBOUND_CALL", { firstName: "Bonjour" }).replace("Bonjour Bonjour,", "Bonjour,")
    await sendAutoSms({ organizationId, advisorId, leadId, clientId, to: fromNumber, from: settings.twilioPhoneNumber, body })
  }

  await runAutomationsForEvent({
    organizationId,
    userId: advisorId,
    leadId,
    clientId,
    event: "INBOUND_CALL_RECEIVED",
    title: "Appel entrant reçu",
    description: fromNumber,
    entityType: "call",
    entityId: call.id,
    payload: {
      callId: call.id,
      callSid,
      phone: fromNumber,
      fromNumber,
      toNumber,
      leadId,
      clientId,
      advisorId,
      matchedEntityType: match.type,
      matchedEntityId: match.id,
      callerName: match.displayName ?? null,
    },
  })
  return call
}

export async function handleCallStatus({ callSid, status, duration, recordingUrl }: { callSid: string; status?: string; duration?: string; recordingUrl?: string }) {
  const existing = await prisma.callLog.findUnique({ where: { twilioCallSid: callSid } })
  if (!existing) throw new Error("CALL_NOT_FOUND")
  const twilioStatus = callStatusFromTwilio(status)
  const hasVoicemail = Boolean(existing.recordingUrl || existing.recordingSid || existing.notes?.includes("Message vocal"))
  const nextStatus = hasVoicemail && twilioStatus === "COMPLETED" ? "MISSED" : twilioStatus
  const durationSeconds = duration ? Number.parseInt(duration, 10) : undefined
  await prisma.callLog.updateMany({
    where: { id: existing.id, organizationId: existing.organizationId },
    data: { status: nextStatus, durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : undefined, duration: Number.isFinite(durationSeconds) ? durationSeconds : undefined, recordingUrl },
  })
  const call = await prisma.callLog.findFirstOrThrow({ where: { id: existing.id, organizationId: existing.organizationId } })
  if (hasVoicemail && twilioStatus === "COMPLETED") return call
  if (["MISSED", "BUSY", "NO_ANSWER", "FAILED"].includes(nextStatus)) {
    await createCrmActivity({ organizationId: call.organizationId, userId: null, leadId: call.leadId, clientId: call.clientId, type: "CALL_MISSED", title: "Appel manqué", description: call.fromNumber, source: "WEBHOOK", entityType: "CallLog", entityId: call.id })
    await notifyAdvisor({ organizationId: call.organizationId, advisorId: call.advisorId, type: "CALL_MISSED", title: "Appel manqué", message: `Appel manqué de ${call.fromNumber}.`, actionUrl: call.leadId ? `/prospects/${call.leadId}` : call.clientId ? `/clients/${call.clientId}` : "/communications", leadId: call.leadId, clientId: call.clientId })
    await createFollowUpForCommunication({ organizationId: call.organizationId, userId: call.advisorId ?? "", advisorId: call.advisorId, leadId: call.leadId, clientId: call.clientId, title: "Rappeler après appel manqué", type: "CALL" })
  } else if (nextStatus === "COMPLETED") {
    await createCrmActivity({ organizationId: call.organizationId, userId: null, leadId: call.leadId, clientId: call.clientId, type: "CALL_COMPLETED", title: "Appel complété", description: call.fromNumber, source: "WEBHOOK", entityType: "CallLog", entityId: call.id })
    await runAutomationsForEvent({
      organizationId: call.organizationId,
      userId: null,
      leadId: call.leadId,
      clientId: call.clientId,
      event: "CALL_COMPLETED",
      title: "Appel complété",
      description: call.fromNumber,
      entityType: "call",
      entityId: call.id,
      payload: {
        callId: call.id,
        fromNumber: call.fromNumber,
        toNumber: call.toNumber,
        durationSeconds: call.durationSeconds,
        recordingUrl: call.recordingUrl,
      },
    })
  }
  return call
}

async function sendAutoSms({ organizationId, advisorId, leadId, clientId, to, from, body }: { organizationId: string; advisorId?: string | null; leadId?: string | null; clientId?: string | null; to: string; from: string; body: string }) {
  assertAdministrativeSms(body)
  const settings = await ensureCommunicationSettings(organizationId)
  try {
    const sent = await sendTwilioSms({
      to,
      from,
      body,
      statusCallback: getAppUrl() ? `${getAppUrl()}/api/webhooks/twilio/sms-status` : undefined,
      credentials: twilioCredentials(settings),
    })
    return prisma.sMSMessage.create({
      data: { organizationId, leadId, clientId, advisorId, direction: "OUTBOUND", status: "QUEUED", fromNumber: from, toNumber: to, phoneNumber: to, body, twilioMessageSid: sent.sid },
    })
  } catch (error) {
    await prisma.sMSMessage.create({
      data: { organizationId, leadId, clientId, advisorId, direction: "OUTBOUND", status: "FAILED", fromNumber: from, toNumber: to, phoneNumber: to, body, errorMessage: error instanceof Error ? error.message.slice(0, 240) : "Erreur Twilio" },
    })
    throw error
  }
}

async function sendAdvisorSmsNotification({
  organizationId,
  advisorId,
  leadId,
  clientId,
  from,
  to,
  body,
}: {
  organizationId: string
  advisorId?: string | null
  leadId?: string | null
  clientId?: string | null
  from?: string | null
  to?: string | null
  body: string
}) {
  const fromNumber = normalizePhoneNumber(from)
  const toNumber = normalizePhoneNumber(to)
  if (!fromNumber || !toNumber || fromNumber === toNumber) return null
  return sendAutoSms({ organizationId, advisorId, leadId, clientId, to: toNumber, from: fromNumber, body })
}

function personDisplayName(call: { leadId?: string | null; clientId?: string | null; fromNumber: string }) {
  return call.fromNumber
}

function voicemailActionUrl(call: { leadId?: string | null; clientId?: string | null }) {
  if (call.leadId) return `/prospects/${call.leadId}`
  if (call.clientId) return `/clients/${call.clientId}`
  return "/communications"
}

function absoluteActionUrl(path: string) {
  const appUrl = getAppUrl()
  if (!appUrl) return path
  return `${appUrl}${path.startsWith("/") ? path : `/${path}`}`
}

export async function handleVoicemailRecording({
  callSid,
  recordingUrl,
  recordingDuration,
  recordingSid,
}: {
  callSid: string
  recordingUrl?: string
  recordingDuration?: string
  recordingSid?: string
}) {
  const existing = await prisma.callLog.findUnique({ where: { twilioCallSid: callSid } })
  if (!existing) throw new Error("CALL_NOT_FOUND")
  const durationSeconds = recordingDuration ? Number.parseInt(recordingDuration, 10) : undefined
  await prisma.callLog.updateMany({
    where: { id: existing.id, organizationId: existing.organizationId },
    data: {
      status: "MISSED",
      recordingUrl,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : existing.durationSeconds,
      duration: Number.isFinite(durationSeconds) ? durationSeconds : existing.duration,
      notes: recordingSid ? `Message vocal enregistré (${recordingSid}).` : "Message vocal enregistré.",
    },
  })
  const call = await prisma.callLog.findFirstOrThrow({ where: { id: existing.id, organizationId: existing.organizationId } })
  const settings = await ensureCommunicationSettings(call.organizationId)
  await ensureCallTranscription({ callLogId: call.id, organizationId: call.organizationId, userId: call.advisorId })
  const actionPath = voicemailActionUrl(call)
  const caller = personDisplayName(call)
  const durationLabel = Number.isFinite(durationSeconds) ? `${durationSeconds}s` : "durée inconnue"

  await createCrmActivity({
    organizationId: call.organizationId,
    userId: null,
    leadId: call.leadId,
    clientId: call.clientId,
    type: "CALL_MISSED",
    title: "Message vocal reçu",
    description: `Message vocal de ${caller} (${durationLabel}).`,
    source: "WEBHOOK",
    entityType: "CallLog",
    entityId: call.id,
    metadata: { recordingUrl, recordingSid },
  })

  await notifyAdvisor({
    organizationId: call.organizationId,
    advisorId: call.advisorId,
    type: "CALL_MISSED",
    title: "Message vocal à traiter",
    message: `Un message vocal a été laissé par ${caller}.`,
    actionUrl: actionPath,
    leadId: call.leadId,
    clientId: call.clientId,
  })

  await createFollowUpForCommunication({
    organizationId: call.organizationId,
    userId: call.advisorId ?? "",
    advisorId: call.advisorId,
    leadId: call.leadId,
    clientId: call.clientId,
    title: "Écouter le message vocal et rappeler",
    type: "CALL",
  })

  try {
    await sendAdvisorSmsNotification({
      organizationId: call.organizationId,
      advisorId: call.advisorId,
      leadId: call.leadId,
      clientId: call.clientId,
      from: settings.twilioPhoneNumber,
      to: settings.advisorSmsNotificationNumber,
      body: `FinAssuro: message vocal de ${caller} (${durationLabel}). Tâche de rappel créée. ${absoluteActionUrl(actionPath)}`,
    })
  } catch (error) {
    await createCrmActivity({
      organizationId: call.organizationId,
      userId: null,
      leadId: call.leadId,
      clientId: call.clientId,
      type: "SMS_FAILED",
      title: "Échec SMS conseiller",
      description: error instanceof Error ? error.message.slice(0, 160) : "Impossible d’aviser le conseiller par SMS.",
      source: "WEBHOOK",
      entityType: "CallLog",
      entityId: call.id,
    })
  }

  if (settings.autoReplyEnabled && settings.twilioPhoneNumber && call.fromNumber) {
    await sendAutoSms({
      organizationId: call.organizationId,
      advisorId: call.advisorId,
      leadId: call.leadId,
      clientId: call.clientId,
      to: call.fromNumber,
      from: settings.twilioPhoneNumber,
      body: "Bonjour, votre message vocal a bien été reçu. Un conseiller vous contactera dès que possible.",
    })
  }

  if (settings.autoTranscribeCalls && call.recordingUrl && call.advisorId) {
    void transcribeCall({
      callLogId: call.id,
      organizationId: call.organizationId,
      userId: call.advisorId,
      language: settings.transcriptionLanguage === "en" ? "en" : "fr",
    }).catch(async (error) => {
      await createCrmActivity({
        organizationId: call.organizationId,
        userId: null,
        leadId: call.leadId,
        clientId: call.clientId,
        type: "CALL_TRANSCRIPTION_FAILED",
        title: "Transcription automatique échouée",
        description: error instanceof Error ? error.message.slice(0, 160) : "Erreur transcription",
        source: "AI",
        entityType: "CallLog",
        entityId: call.id,
      })
    })
  }

  return call
}

export async function handleIncomingSms({ from, to, body, messageSid }: { from: string; to: string; body: string; messageSid: string }) {
  const orgMatch = await findOrganizationByTwilioNumber(to)
  if (!orgMatch) throw new Error("TWILIO_ORGANIZATION_NOT_FOUND")
  const { organizationId } = orgMatch
  const settings = orgMatch.settings ?? await ensureCommunicationSettings(organizationId)
  const fromNumber = normalizePhoneNumber(from)
  const toNumber = normalizePhoneNumber(to)
  const match = await findPersonByPhone({ organizationId, phoneNumber: fromNumber })
  const advisorId = await getAdvisorForOrganization(organizationId, match.advisorId ?? settings.defaultAdvisorId)
  let leadId = match.type === "LEAD" ? match.id : null
  const clientId = match.type === "CLIENT" ? match.id : null
  let createdLeadFromSms = false

  if (!match.id && settings.inboundSmsAutoCreateLead) {
    const lead = await createLeadFromCommunication({ organizationId, advisorId, phone: fromNumber, source: "SMS" })
    leadId = lead.id
    createdLeadFromSms = true
    await createCrmActivity({ organizationId, userId: null, leadId, type: "LEAD_CREATED", title: "Prospect créé depuis SMS", description: fromNumber, source: "WEBHOOK" })
    await notifyAdvisor({ organizationId, advisorId, type: "NEW_LEAD_FROM_SMS", title: "Nouveau prospect depuis SMS", message: `Un SMS entrant inconnu a créé un prospect: ${fromNumber}.`, actionUrl: `/prospects/${leadId}`, leadId })
    await runAutomationsForEvent({ organizationId, userId: null, leadId, event: "LEAD_CREATED", title: "Prospect créé depuis SMS", description: fromNumber, payload: { source: "SMS", phone: fromNumber, firstName: lead.firstName, lastName: lead.lastName, fullName: `${lead.firstName} ${lead.lastName}`, advisorId } })
  }

  const sms = await prisma.sMSMessage.upsert({
    where: { twilioMessageSid: messageSid },
    update: { body, leadId, clientId, advisorId },
    create: { organizationId, leadId, clientId, advisorId, direction: "INBOUND", status: "RECEIVED", fromNumber, toNumber, phoneNumber: fromNumber, body, twilioMessageSid: messageSid, matchedEntityType: match.type, matchedEntityId: match.id },
  })

  await createCrmActivity({ organizationId, userId: null, leadId, clientId, type: "SMS_RECEIVED", title: "SMS reçu", description: body.slice(0, 160), source: "WEBHOOK", entityType: "SMSMessage", entityId: sms.id })
  await notifyAdvisor({ organizationId, advisorId, type: "SMS_RECEIVED", title: "Nouveau SMS reçu", message: `${match.displayName ?? fromNumber}: ${body.slice(0, 120)}`, actionUrl: leadId ? `/prospects/${leadId}` : clientId ? `/clients/${clientId}` : "/communications", leadId, clientId })
  const intake = leadId
    ? await runLeadIntakeAutomation({
        organizationId,
        advisorId,
        leadId,
        source: "SMS",
        message: body,
        phone: fromNumber,
        createFollowUpTasks: createdLeadFromSms || match.type === "LEAD",
        extraContext: { smsId: sms.id, messageSid },
      })
    : null

  const assistant = await runFinassuroBookingAssistant({
    organizationId,
    advisorId,
    leadId,
    clientId,
    smsId: sms.id,
    fromNumber,
    body,
  })
  const autoReplyBody = assistant.reply ?? (createdLeadFromSms ? intake?.clientSmsBody : null)
  if (autoReplyBody && settings.autoReplyEnabled && settings.twilioPhoneNumber) {
    try {
      await sendAutoSms({
        organizationId,
        advisorId,
        leadId,
        clientId,
        to: fromNumber,
        from: settings.twilioPhoneNumber,
        body: autoReplyBody,
      })
    } catch (error) {
      console.warn({
        action: "booking_assistant_reply_failed",
        name: error instanceof Error ? error.name : "UnknownError",
      })
    }
  }

  await runAutomationsForEvent({ organizationId, userId: null, leadId, clientId, event: "INBOUND_SMS_RECEIVED", title: "SMS entrant reçu", description: body.slice(0, 160), payload: { phone: fromNumber, leadId, clientId, advisorId, body } })
  return sms
}

export async function handleSmsStatus({ messageSid, status, errorCode, errorMessage }: { messageSid: string; status?: string; errorCode?: string; errorMessage?: string }) {
  const existing = await prisma.sMSMessage.findUnique({ where: { twilioMessageSid: messageSid } })
  if (!existing) throw new Error("SMS_NOT_FOUND")
  const nextStatus = smsStatusFromTwilio(status)
  await prisma.sMSMessage.updateMany({
    where: { id: existing.id, organizationId: existing.organizationId },
    data: { status: nextStatus, errorCode, errorMessage },
  })
  const sms = await prisma.sMSMessage.findFirstOrThrow({ where: { id: existing.id, organizationId: existing.organizationId } })
  if (nextStatus === "FAILED" || nextStatus === "UNDELIVERED") {
    await createCrmActivity({ organizationId: sms.organizationId, userId: null, leadId: sms.leadId, clientId: sms.clientId, type: "SMS_FAILED", title: "Échec SMS", description: errorMessage ?? sms.toNumber, source: "WEBHOOK", entityType: "SMSMessage", entityId: sms.id })
    await notifyAdvisor({ organizationId: sms.organizationId, advisorId: sms.advisorId, type: "SMS_FAILED", title: "Échec envoi SMS", message: errorMessage ?? `Le SMS vers ${sms.toNumber} a échoué.`, actionUrl: sms.leadId ? `/prospects/${sms.leadId}` : sms.clientId ? `/clients/${sms.clientId}` : "/communications", leadId: sms.leadId, clientId: sms.clientId })
    await runAutomationsForEvent({ organizationId: sms.organizationId, userId: null, leadId: sms.leadId, clientId: sms.clientId, event: "SMS_FAILED", title: "Échec SMS", description: errorMessage ?? sms.toNumber, payload: { phone: sms.toNumber, errorCode, errorMessage } })
  }
  return sms
}

async function assertSmsConsent({ organizationId, clientId }: { organizationId: string; clientId?: string | null }) {
  if (!clientId) return
  const revoked = await prisma.clientConsent.findFirst({
    where: {
      organizationId,
      clientId,
      status: "REVOKED",
      OR: [{ type: { contains: "sms", mode: "insensitive" } }, { type: { contains: "communication", mode: "insensitive" } }, { type: { contains: "électronique", mode: "insensitive" } }],
    },
  })
  if (revoked) throw new Error("SMS_CONSENT_REVOKED")
}

export async function sendSmsFromCrm({ user, to, body, leadId, clientId, isMarketing = false }: { user: CurrentUser; to: string; body: string; leadId?: string; clientId?: string; isMarketing?: boolean }) {
  assertRateLimit({ key: rateLimitKey(["sms_user_hour", user.organizationId, user.id]), limit: 10, windowMs: 60 * 60 * 1000 })
  assertRateLimit({ key: rateLimitKey(["sms_org_day", user.organizationId]), limit: 50, windowMs: 24 * 60 * 60 * 1000 })
  assertAdministrativeSms(body)
  await assertSmsConsent({ organizationId: user.organizationId, clientId })
  if (isMarketing && clientId) {
    await assertActivePurposeConsent({ organizationId: user.organizationId, clientId, purposeCode: "marketing", errorCode: "MARKETING_CONSENT_REQUIRED" })
  }

  const settings = await ensureCommunicationSettings(user.organizationId)
  const from = normalizePhoneNumber(settings.twilioPhoneNumber ?? process.env.TWILIO_PHONE_NUMBER)
  if (!from) throw new Error("TWILIO_PHONE_NUMBER_MISSING")

  let advisorId: string | null = user.id
  if (leadId) {
    const lead = await prisma.lead.findFirstOrThrow({ where: { id: leadId, organizationId: user.organizationId }, select: { advisorId: true } })
    advisorId = lead.advisorId ?? user.id
  }
  if (clientId) {
    const client = await prisma.client.findFirstOrThrow({ where: { id: clientId, organizationId: user.organizationId }, select: { advisorId: true } })
    advisorId = client.advisorId ?? user.id
  }

  const toNumber = normalizePhoneNumber(to)
  try {
    const sent = await sendTwilioSms({
      to: toNumber,
      from,
      body,
      statusCallback: getAppUrl() ? `${getAppUrl()}/api/webhooks/twilio/sms-status` : undefined,
      credentials: twilioCredentials(settings),
    })
    const sms = await prisma.sMSMessage.create({
      data: { organizationId: user.organizationId, leadId, clientId, advisorId, direction: "OUTBOUND", status: "QUEUED", fromNumber: from, toNumber, phoneNumber: toNumber, body, twilioMessageSid: sent.sid },
    })
    await createCrmActivity({ organizationId: user.organizationId, userId: user.id, leadId, clientId, type: "SMS_SENT", title: "SMS envoyé", description: body.slice(0, 160), entityType: "SMSMessage", entityId: sms.id })
    return sms
  } catch (error) {
    const sms = await prisma.sMSMessage.create({
      data: { organizationId: user.organizationId, leadId, clientId, advisorId, direction: "OUTBOUND", status: "FAILED", fromNumber: from, toNumber, phoneNumber: toNumber, body, errorMessage: error instanceof Error ? error.message.slice(0, 240) : "Erreur Twilio" },
    })
    await createCrmActivity({ organizationId: user.organizationId, userId: user.id, leadId, clientId, type: "SMS_FAILED", title: "Échec SMS", description: sms.errorMessage, entityType: "SMSMessage", entityId: sms.id })
    throw error
  }
}

export async function getCalls({ organizationId, query }: { organizationId: string; query: { leadId?: string; clientId?: string; advisorId?: string; status?: string; direction?: CommunicationDirection; page: number; limit: number } }) {
  const where: Prisma.CallLogWhereInput = {
    organizationId,
    ...(query.leadId ? { leadId: query.leadId } : {}),
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.advisorId ? { advisorId: query.advisorId } : {}),
    ...(query.status ? { status: query.status as CallStatus } : {}),
    ...(query.direction ? { direction: query.direction } : {}),
  }
  const skip = (query.page - 1) * query.limit
  const [items, total] = await Promise.all([
    prisma.callLog.findMany({ where, include: { lead: true, client: true, transcription: true, advisor: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, skip, take: query.limit }),
    prisma.callLog.count({ where }),
  ])
  return {
    items: items.map(({ recordingUrl, transcription, ...item }) => ({
      ...item,
      hasRecording: Boolean(recordingUrl || item.recordingSid),
      transcription: transcription
        ? {
            ...transcription,
            audioUrl: undefined,
            audioStoragePath: undefined,
          }
        : null,
    })),
    total,
    page: query.page,
    limit: query.limit,
  }
}

export async function getSmsMessages({ organizationId, query }: { organizationId: string; query: { leadId?: string; clientId?: string; advisorId?: string; status?: string; direction?: CommunicationDirection; page: number; limit: number } }) {
  const where: Prisma.SMSMessageWhereInput = {
    organizationId,
    ...(query.leadId ? { leadId: query.leadId } : {}),
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.advisorId ? { advisorId: query.advisorId } : {}),
    ...(query.status ? { status: query.status as CommunicationStatus } : {}),
    ...(query.direction ? { direction: query.direction } : {}),
  }
  const skip = (query.page - 1) * query.limit
  const [items, total] = await Promise.all([
    prisma.sMSMessage.findMany({ where, include: { lead: true, client: true, advisor: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, skip, take: query.limit }),
    prisma.sMSMessage.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}
