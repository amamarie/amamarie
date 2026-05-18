import { timingSafeEqual } from "node:crypto"

import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { getAdvisorVoiceAutomationVariables } from "@/lib/retell/advisor-voice-settings"
import { buildRetellConversationMemory } from "@/lib/retell/conversation-memory"
import { generateAdvisorCallBrief, sendAdvisorCallEmailAndSms } from "@/lib/retell/advisor-call-notifications"
import { createNotification } from "@/lib/services/notifications"
import { findOrganizationByTwilioNumber, findPersonByPhone } from "@/lib/twilio/matching"
import { normalizePhoneNumber } from "@/lib/twilio/phone"

const lookupSchema = z.object({
  from_number: z.string().optional(),
  to_number: z.string().optional(),
  call_id: z.string().optional(),
  raw_call: z.unknown().optional(),
})

function n8nSecret() {
  return process.env.N8N_AUTOMATION_WEBHOOK_SECRET?.trim() || process.env.N8N_WEBHOOK_SECRET?.trim()
}

function safeEqual(left?: string | null, right?: string | null) {
  if (!left || !right) return false
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

async function defaultAdvisor(organizationId: string, preferredAdvisorId?: string | null) {
  if (preferredAdvisorId) {
    const advisor = await prisma.user.findFirst({
      where: { id: preferredAdvisorId, organizationId },
      select: { id: true, name: true, email: true, specialties: true },
    })
    if (advisor) return advisor
  }

  const owner = await prisma.user.findFirst({
    where: { organizationId, role: "OWNER" },
    select: { id: true, name: true, email: true, specialties: true },
  })
  if (owner) return owner

  return prisma.user.findFirst({
    where: { organizationId },
    select: { id: true, name: true, email: true, specialties: true },
  })
}

export async function POST(request: Request) {
  try {
    const secret = n8nSecret()
    if (!secret) return fail("N8N_SECRET_MISSING", "Secret n8n non configuré.", 503)
    if (!safeEqual(request.headers.get("x-n8n-secret"), secret)) return fail("UNAUTHORIZED", "Webhook Retell/n8n non autorisé.", 401)

    const payload = lookupSchema.parse(await request.json())
    const fromNumber = normalizePhoneNumber(payload.from_number)
    const toNumber = normalizePhoneNumber(payload.to_number)
    if (!fromNumber || !toNumber) return fail("MISSING_PHONE", "Numéro entrant ou numéro cabinet manquant.", 422)

    const orgMatch = await findOrganizationByTwilioNumber(toNumber)
    if (!orgMatch) return fail("ORGANIZATION_NOT_FOUND", "Aucun cabinet trouvé pour ce numéro.", 404)

    const { organizationId } = orgMatch
    const match = await findPersonByPhone({ organizationId, phoneNumber: fromNumber })
    const advisor = await defaultAdvisor(organizationId, match.advisorId ?? orgMatch.settings?.defaultAdvisorId)

    let leadId = match.type === "LEAD" ? match.id : null
    let client = match.type === "CLIENT" && match.id
      ? await prisma.client.findFirst({
          where: { id: match.id, organizationId },
          select: { id: true, firstName: true, lastName: true, province: true, status: true, goals: true, primaryGoal: true, advisorId: true },
        })
      : null
    let lead = leadId
      ? await prisma.lead.findFirst({
          where: { id: leadId, organizationId },
          select: { id: true, firstName: true, lastName: true, status: true, interestType: true, advisorId: true },
        })
      : null

    if (!match.id && orgMatch.settings?.inboundCallAutoCreateLead !== false) {
      lead = await prisma.lead.create({
        data: {
          organizationId,
          advisorId: advisor?.id,
          firstName: "Nouveau",
          lastName: "prospect appelant",
          phone: fromNumber,
          source: "INBOUND_CALL",
          status: "NEW",
          priority: "HIGH",
          interestType: "Assurance à déterminer",
          nextAction: "Qualifier l’appel entrant RetellAI",
          notes: payload.call_id ? `Appel entrant RetellAI: ${payload.call_id}` : "Appel entrant RetellAI.",
        },
      })
      leadId = lead.id

      await createCrmActivity({
        organizationId,
        userId: advisor?.id ?? null,
        leadId,
        type: "LEAD_CREATED",
        title: "Prospect créé depuis appel entrant RetellAI",
        description: fromNumber,
        source: "WEBHOOK",
      })
    }

    if (advisor?.id) {
      const actionUrl = leadId ? `/prospects/${leadId}` : client?.id ? `/clients/${client.id}` : "/communications"
      await createNotification({
        organizationId,
        userId: advisor.id,
        type: "CALL_RECEIVED",
        priority: "HIGH",
        title: "Appel entrant RetellAI",
        message: `${match.displayName ?? fromNumber} appelle le cabinet.`,
        actionLabel: "Ouvrir",
        actionUrl,
        leadId: leadId ?? undefined,
        clientId: client?.id ?? undefined,
      })

      const callerName = match.displayName ?? `${lead?.firstName ?? client?.firstName ?? "Client"} ${lead?.lastName ?? client?.lastName ?? ""}`.trim()
      const aiBrief = await generateAdvisorCallBrief({
        organizationId,
        advisorId: advisor.id,
        callerName,
        callerPhone: fromNumber,
        summary: `${callerName} appelle le cabinet via RetellAI.`,
        nextAction: "Répondre à l’appel ou ouvrir le dossier pour préparer le suivi.",
        urgency: "élevée",
        actionUrl,
      })
      await sendAdvisorCallEmailAndSms({
        organizationId,
        advisorId: advisor.id,
        leadId: leadId ?? undefined,
        clientId: client?.id ?? undefined,
        toEmail: advisor.email,
        subject: "Nouvel appel entrant RetellAI",
        text: [
          "Nouvel appel entrant RetellAI",
          "",
          `Appelant: ${callerName}`,
          `Téléphone: ${fromNumber}`,
          `Statut: ${match.id ? "Contact connu" : "Nouveau prospect"}`,
          "",
          "Résumé IA:",
          aiBrief.brief,
          "",
          "Prochaine action:",
          aiBrief.nextAction,
          "",
          "Lien dossier:",
          `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""}${actionUrl}`,
        ].join("\n"),
        smsBody: aiBrief.sms,
      })
    }

    const firstName = lead?.firstName ?? client?.firstName ?? "client"
    const lastName = lead?.lastName ?? client?.lastName ?? ""
    const interest = lead?.interestType ?? client?.primaryGoal ?? client?.goals ?? "à déterminer"
    const memory = await buildRetellConversationMemory({
      organizationId,
      leadId,
      clientId: client?.id,
      phoneNumber: fromNumber,
    })
    const voiceSettings = advisor?.id
      ? await getAdvisorVoiceAutomationVariables({
          organizationId,
          userId: advisor.id,
          advisorName: advisor.name,
          firstName,
          lastName,
          advisorSpecialties: advisor.specialties,
        })
      : null
    const advisorVariables = voiceSettings?.retellVariables ?? {}

    return ok({
      client_known: Boolean(match.id),
      prospect_id: leadId ?? client?.id ?? "unknown",
      client_id: client?.id ?? null,
      first_name: firstName,
      last_name: lastName,
      advisor_id: advisor?.id ?? "",
      advisor_name: advisor?.name ?? "un conseiller",
      advisor_email: advisor?.email ?? "",
      preferred_language: "fr",
      province: client?.province ?? "QC",
      insurance_category: interest,
      insurance_goal: interest,
      status: lead?.status ?? client?.status ?? "nouveau",
      conversation_memory: memory.conversation_memory,
      previous_topics: memory.previous_topics,
      last_call_summary: memory.last_call_summary,
      open_tasks: memory.open_tasks,
      ...advisorVariables,
      dynamic_variables: {
        prospect_id: leadId ?? client?.id ?? "unknown",
        client_known: Boolean(match.id),
        first_name: firstName,
        last_name: lastName,
        advisor_id: advisor?.id ?? "",
        advisor_name: advisor?.name ?? "un conseiller",
        advisor_email: advisor?.email ?? "",
        preferred_language: "fr",
        province: client?.province ?? "QC",
        insurance_category: interest,
        insurance_goal: interest,
        status: lead?.status ?? client?.status ?? "nouveau",
        conversation_memory: memory.conversation_memory,
        previous_topics: memory.previous_topics,
        last_call_summary: memory.last_call_summary,
        open_tasks: memory.open_tasks,
        ...advisorVariables,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
