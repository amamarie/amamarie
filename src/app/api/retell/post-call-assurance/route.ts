import { timingSafeEqual } from "node:crypto"

import { z } from "zod"
import type { Prisma } from "@prisma/client"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createExternalCalendarEvent } from "@/lib/calendar/external"
import { createCrmActivity } from "@/lib/crm-events"
import { appendGoogleSheetRow } from "@/lib/google/sheets"
import { prisma } from "@/lib/prisma"
import { generateAdvisorCallBrief, sendAdvisorCallEmailAndSms } from "@/lib/retell/advisor-call-notifications"
import { createNotification } from "@/lib/services/notifications"
import { normalizePhoneNumber } from "@/lib/twilio/phone"

const postCallSchema = z.object({
  event: z.string().optional(),
  retell_call_id: z.string().optional().nullable(),
  direction: z.string().optional().nullable(),
  prospect_id: z.string().optional().nullable(),
  advisor_id: z.string().optional().nullable(),
  advisor_email: z.string().optional().nullable(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  phone_number: z.string().optional().nullable(),
  insurance_category: z.string().optional().nullable(),
  insurance_goal: z.string().optional().nullable(),
  current_coverage: z.string().optional().nullable(),
  family_context: z.string().optional().nullable(),
  business_context: z.string().optional().nullable(),
  planning_topic: z.string().optional().nullable(),
  life_stage: z.string().optional().nullable(),
  has_existing_advisor: z.string().optional().nullable(),
  investment_knowledge: z.string().optional().nullable(),
  risk_discussion_needed: z.union([z.boolean(), z.string()]).optional().nullable(),
  documents_needed: z.unknown().optional().nullable(),
  meeting_objective: z.string().optional().nullable(),
  urgency_level: z.string().optional().nullable(),
  qualification_status: z.string().optional().nullable(),
  qualification_score: z.union([z.number(), z.string()]).optional().nullable(),
  appointment_requested: z.union([z.boolean(), z.string()]).optional().nullable(),
  appointment_start_at: z.string().optional().nullable(),
  appointment_end_at: z.string().optional().nullable(),
  appointment_timezone: z.string().optional().nullable(),
  preferred_availabilities: z.unknown().optional().nullable(),
  next_action: z.string().optional().nullable(),
  human_review_required: z.union([z.boolean(), z.string()]).optional().nullable(),
  call_summary: z.string().optional().nullable(),
  transcript: z.string().optional().nullable(),
  recording_url: z.string().optional().nullable(),
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

function priorityFromUrgency(value?: string | null) {
  const normalized = (value ?? "").toLowerCase()
  if (normalized.includes("urgent") || normalized.includes("élev") || normalized.includes("elev") || normalized === "high") return "HIGH" as const
  if (normalized.includes("faible") || normalized === "low") return "NORMAL" as const
  return "HIGH" as const
}

function numericScore(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : null
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value
  if (typeof value === "string") return ["true", "1", "oui", "yes", "vrai"].includes(value.trim().toLowerCase())
  return false
}

function optionalDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function jsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value
  if (Array.isArray(value)) return value.map((item) => item === undefined ? null : item) as Prisma.InputJsonArray
  if (typeof value === "object") return value as Prisma.InputJsonObject
  return String(value)
}

function preferredAvailabilitiesLabel(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean).join(", ")
  if (typeof value === "string") return value
  if (value && typeof value === "object") return JSON.stringify(value)
  return ""
}

function appendNote(existing: string | null | undefined, note: string) {
  const previous = existing?.trim()
  return previous ? `${previous}\n\n${note}` : note
}

async function appendRetellCallToGoogleSheet({
  organizationId,
  advisorId,
  lead,
  callId,
  summary,
  nextAction,
  score,
  payload,
}: {
  organizationId: string
  advisorId?: string | null
  lead: { id: string; firstName: string; lastName: string; email: string | null; phone: string; interestType: string | null }
  callId: string
  summary: string
  nextAction: string
  score: number | null
  payload: z.infer<typeof postCallSchema>
}) {
  const spreadsheetId = process.env.RETELL_POST_CALL_GOOGLE_SHEET_ID?.trim()
  if (!spreadsheetId || !advisorId) return { skipped: true as const, reason: "GOOGLE_SHEET_NOT_CONFIGURED" }

  return appendGoogleSheetRow({
    organizationId,
    advisorId,
    spreadsheetId,
    sheetName: process.env.RETELL_POST_CALL_GOOGLE_SHEET_NAME?.trim() || "Retell Calls",
    headers: [
      "Date",
      "Prospect",
      "Téléphone",
      "Courriel",
      "Besoin",
      "Catégorie assurance",
      "Sujet planification",
      "Qualification",
      "Score",
      "Urgence",
      "RDV demandé",
      "Disponibilités",
      "Résumé",
      "Prochaine action",
      "Lead ID",
      "Call ID",
    ],
    row: {
      Date: new Date().toISOString(),
      Prospect: `${lead.firstName} ${lead.lastName}`,
      "Téléphone": lead.phone,
      Courriel: lead.email ?? "",
      Besoin: payload.insurance_goal ?? lead.interestType ?? "",
      "Catégorie assurance": payload.insurance_category ?? "",
      "Sujet planification": payload.planning_topic ?? "",
      Qualification: payload.qualification_status ?? "",
      Score: score ?? "",
      Urgence: payload.urgency_level ?? "",
      "RDV demandé": booleanValue(payload.appointment_requested),
      "Disponibilités": preferredAvailabilitiesLabel(payload.preferred_availabilities),
      Résumé: summary,
      "Prochaine action": nextAction,
      "Lead ID": lead.id,
      "Call ID": callId,
    },
  }).catch((error) => ({ skipped: true as const, reason: error instanceof Error ? error.message.slice(0, 180) : "GOOGLE_SHEET_ERROR" }))
}

async function findOrCreateLead(input: z.infer<typeof postCallSchema>) {
  if (input.prospect_id) {
    const lead = await prisma.lead.findUnique({
      where: { id: input.prospect_id },
      include: { advisor: { select: { id: true, name: true, email: true, organizationId: true } } },
    })
    if (lead) return lead
  }

  const advisor = input.advisor_id
    ? await prisma.user.findUnique({ where: { id: input.advisor_id }, select: { id: true, organizationId: true, name: true, email: true } })
    : input.advisor_email
      ? await prisma.user.findFirst({ where: { email: input.advisor_email }, select: { id: true, organizationId: true, name: true, email: true } })
      : null

  const phone = normalizePhoneNumber(input.phone_number)
  if (advisor?.organizationId && phone) {
    const existing = await prisma.lead.findFirst({
      where: { organizationId: advisor.organizationId, phone, status: { notIn: ["ARCHIVED", "LOST", "CONVERTED"] } },
      include: { advisor: { select: { id: true, name: true, email: true, organizationId: true } } },
    })
    if (existing) return existing
  }

  if (!advisor?.organizationId || !phone) return null

  return prisma.lead.create({
    data: {
      organizationId: advisor.organizationId,
      advisorId: advisor.id,
      firstName: input.first_name?.trim() || "Prospect",
      lastName: input.last_name?.trim() || "RetellAI",
      phone,
      source: "INBOUND_CALL",
      status: "QUALIFIED",
      priority: priorityFromUrgency(input.urgency_level),
      interestType: input.insurance_category ?? input.insurance_goal ?? "Assurance",
      nextAction: input.next_action ?? "Réviser le résumé RetellAI",
      notes: "Prospect créé depuis le webhook post-appel RetellAI.",
    },
    include: { advisor: { select: { id: true, name: true, email: true, organizationId: true } } },
  })
}

export async function POST(request: Request) {
  try {
    const secret = n8nSecret()
    if (!secret) return fail("N8N_SECRET_MISSING", "Secret n8n non configuré.", 503)
    if (!safeEqual(request.headers.get("x-n8n-secret"), secret)) return fail("UNAUTHORIZED", "Webhook Retell/n8n non autorisé.", 401)

    const payload = postCallSchema.parse(await request.json())
    const lead = await findOrCreateLead(payload)
    if (!lead) return fail("LEAD_NOT_FOUND", "Impossible de trouver ou créer le prospect post-appel.", 404)

    const organizationId = lead.organizationId
    const advisorId = payload.advisor_id ?? lead.advisorId ?? lead.advisor?.id ?? null
    const score = numericScore(payload.qualification_score)
    const availabilities = preferredAvailabilitiesLabel(payload.preferred_availabilities)
    const summary = payload.call_summary?.trim() || "Résumé RetellAI non fourni."
    const nextAction = payload.next_action?.trim() || "Réviser le résumé d’appel et confirmer la prochaine action."
    const appointmentRequested = booleanValue(payload.appointment_requested)
    const appointmentStart = optionalDate(payload.appointment_start_at)
    const appointmentEnd = optionalDate(payload.appointment_end_at) ?? (appointmentStart ? new Date(appointmentStart.getTime() + 30 * 60 * 1000) : null)
    const status = payload.qualification_status?.toLowerCase().includes("qual") ? "QUALIFIED" : lead.status
    const note = [
      "Résumé appel RetellAI",
      payload.retell_call_id ? `Appel: ${payload.retell_call_id}` : null,
      payload.insurance_category ? `Catégorie assurance: ${payload.insurance_category}` : null,
      payload.insurance_goal ? `Objectif: ${payload.insurance_goal}` : null,
      score !== null ? `Score: ${score}/100` : null,
      payload.urgency_level ? `Urgence: ${payload.urgency_level}` : null,
      availabilities ? `Disponibilités: ${availabilities}` : null,
      `Résumé: ${summary}`,
      `Prochaine action: ${nextAction}`,
      "Note conformité: préqualification seulement. Le conseiller doit valider avant toute recommandation.",
    ].filter(Boolean).join("\n")

    const updatedLead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status,
        priority: priorityFromUrgency(payload.urgency_level),
        interestType: payload.insurance_category ?? lead.interestType,
        nextAction,
        notes: appendNote(lead.notes, note),
        lastContactAt: new Date(),
      },
    })

    const callSid = payload.retell_call_id ? `retell:${payload.retell_call_id}` : `retell:${lead.id}:${Date.now()}`
    const call = await prisma.callLog.upsert({
      where: { twilioCallSid: callSid },
      update: {
        status: "COMPLETED",
        leadId: lead.id,
        advisorId,
        durationSeconds: undefined,
        recordingUrl: payload.recording_url ?? undefined,
        transcriptionStatus: payload.transcript ? "COMPLETED" : undefined,
        notes: summary,
      },
      create: {
        organizationId,
        leadId: lead.id,
        advisorId,
        direction: (payload.direction ?? "OUTBOUND").toUpperCase().includes("INBOUND") ? "INBOUND" : "OUTBOUND",
        status: "COMPLETED",
        fromNumber: "",
        toNumber: normalizePhoneNumber(payload.phone_number),
        phoneNumber: normalizePhoneNumber(payload.phone_number),
        twilioCallSid: callSid,
        recordingUrl: payload.recording_url ?? undefined,
        transcriptionStatus: payload.transcript ? "COMPLETED" : undefined,
        notes: summary,
      },
    })

    await prisma.leadInsuranceProfile.upsert({
      where: { leadId: lead.id },
      update: {
        insuranceCategory: payload.insurance_category ?? undefined,
        currentCoverage: payload.current_coverage ?? undefined,
        familyContext: payload.family_context ?? undefined,
        businessContext: payload.business_context ?? undefined,
        urgencyLevel: payload.urgency_level ?? undefined,
        mainGoal: payload.insurance_goal ?? undefined,
        advisorNotes: summary,
        qualificationScore: score ?? undefined,
        appointmentRequested,
        preferredAvailabilities: jsonValue(payload.preferred_availabilities),
        humanReviewRequired: booleanValue(payload.human_review_required) || true,
        sourceCallId: call.id,
      },
      create: {
        organizationId,
        leadId: lead.id,
        insuranceCategory: payload.insurance_category ?? null,
        currentCoverage: payload.current_coverage ?? null,
        familyContext: payload.family_context ?? null,
        businessContext: payload.business_context ?? null,
        urgencyLevel: payload.urgency_level ?? null,
        mainGoal: payload.insurance_goal ?? null,
        advisorNotes: summary,
        qualificationScore: score,
        appointmentRequested,
        preferredAvailabilities: jsonValue(payload.preferred_availabilities),
        humanReviewRequired: booleanValue(payload.human_review_required) || true,
        sourceCallId: call.id,
      },
    })

    if (payload.planning_topic || payload.meeting_objective || payload.documents_needed) {
      await prisma.leadFinancialPlanningProfile.upsert({
        where: { leadId: lead.id },
        update: {
          planningTopic: payload.planning_topic ?? undefined,
          lifeStage: payload.life_stage ?? undefined,
          hasExistingAdvisor: payload.has_existing_advisor ?? undefined,
          investmentKnowledge: payload.investment_knowledge ?? undefined,
          riskDiscussionNeeded: payload.risk_discussion_needed === undefined || payload.risk_discussion_needed === null ? undefined : booleanValue(payload.risk_discussion_needed),
          documentsNeeded: jsonValue(payload.documents_needed),
          meetingObjective: payload.meeting_objective ?? undefined,
          advisorNotes: summary,
          qualificationScore: score ?? undefined,
          appointmentRequested,
          preferredAvailabilities: jsonValue(payload.preferred_availabilities),
          humanReviewRequired: booleanValue(payload.human_review_required) || true,
          sourceCallId: call.id,
        },
        create: {
          organizationId,
          leadId: lead.id,
          planningTopic: payload.planning_topic ?? null,
          lifeStage: payload.life_stage ?? null,
          hasExistingAdvisor: payload.has_existing_advisor ?? null,
          investmentKnowledge: payload.investment_knowledge ?? null,
          riskDiscussionNeeded: payload.risk_discussion_needed === undefined || payload.risk_discussion_needed === null ? null : booleanValue(payload.risk_discussion_needed),
          documentsNeeded: jsonValue(payload.documents_needed),
          meetingObjective: payload.meeting_objective ?? null,
          advisorNotes: summary,
          qualificationScore: score,
          appointmentRequested,
          preferredAvailabilities: jsonValue(payload.preferred_availabilities),
          humanReviewRequired: booleanValue(payload.human_review_required) || true,
          sourceCallId: call.id,
        },
      })
    }

    if (payload.transcript || summary) {
      const summaryPayload = {
        text: summary,
        qualificationScore: score,
        urgencyLevel: payload.urgency_level ?? null,
        nextAction,
        preferredAvailabilities: payload.preferred_availabilities ?? null,
        humanReviewRequired: payload.human_review_required ?? true,
      }

      await prisma.callTranscription.upsert({
        where: { callLogId: call.id },
        update: {
          status: "COMPLETED",
          rawTranscript: payload.transcript ?? undefined,
          summary: summaryPayload,
          audioUrl: payload.recording_url ?? undefined,
        },
        create: {
          organizationId,
          callLogId: call.id,
          leadId: lead.id,
          createdById: advisorId,
          status: "COMPLETED",
          language: "fr",
          rawTranscript: payload.transcript ?? null,
          summary: summaryPayload,
          audioUrl: payload.recording_url ?? null,
        },
      })
    }

    const task = await prisma.task.create({
      data: {
        organizationId,
        assignedToId: advisorId,
        createdById: advisorId,
        leadId: lead.id,
        title: "Réviser le résumé d’appel RetellAI",
        description: note.slice(0, 1000),
        priority: priorityFromUrgency(payload.urgency_level),
        type: "CALL",
        status: "TODO",
        isAutomated: true,
        dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    })

    let calendarEventId: string | null = null
    if (appointmentRequested && advisorId && appointmentStart && appointmentEnd && appointmentEnd > appointmentStart) {
      const existingEvent = await prisma.calendarEvent.findFirst({
        where: { organizationId, leadId: lead.id, source: "RETELL_AI", startAt: appointmentStart, status: { not: "CANCELLED" } },
        select: { id: true },
      })

      if (existingEvent) {
        calendarEventId = existingEvent.id
      } else {
        const external = await createExternalCalendarEvent({
          organizationId,
          advisorId,
          title: `Découverte RetellAI - ${updatedLead.firstName} ${updatedLead.lastName}`,
          description: note,
          start: appointmentStart,
          end: appointmentEnd,
          timezone: payload.appointment_timezone ?? "America/Toronto",
          locationType: "VIDEO",
          meetingProvider: "GOOGLE_MEET",
          attendeeEmail: updatedLead.email ?? null,
        })

        const event = await prisma.calendarEvent.create({
          data: {
            organizationId,
            advisorId,
            createdById: advisorId,
            leadId: lead.id,
            taskId: task.id,
            title: `Découverte RetellAI - ${updatedLead.firstName} ${updatedLead.lastName}`,
            description: note,
            type: "MEETING",
            status: "TENTATIVE",
            priority: priorityFromUrgency(payload.urgency_level),
            startAt: appointmentStart,
            endAt: appointmentEnd,
            timezone: payload.appointment_timezone ?? "America/Toronto",
            locationType: "VIDEO",
            meetingUrl: external.meetingUrl,
            externalEventId: external.externalEventId,
            source: "RETELL_AI",
            questionnaireAnswers: {
              retellCallId: payload.retell_call_id,
              preferredAvailabilities: payload.preferred_availabilities ?? null,
              appointmentRequested,
              humanReviewRequired: true,
            },
          },
        })
        calendarEventId = event.id
      }
    }

    const sheets = await appendRetellCallToGoogleSheet({
      organizationId,
      advisorId,
      lead: {
        id: updatedLead.id,
        firstName: updatedLead.firstName,
        lastName: updatedLead.lastName,
        email: updatedLead.email,
        phone: updatedLead.phone,
        interestType: updatedLead.interestType,
      },
      callId: call.id,
      summary,
      nextAction,
      score,
      payload,
    })

    await createCrmActivity({
      organizationId,
      userId: advisorId,
      leadId: lead.id,
      taskId: task.id,
      type: "CALL_TRANSCRIBED",
      title: "Résumé RetellAI reçu",
      description: summary.slice(0, 240),
      source: "WEBHOOK",
      entityType: "CallLog",
      entityId: call.id,
      metadata: {
        retellCallId: payload.retell_call_id,
        qualificationScore: score,
        urgencyLevel: payload.urgency_level,
        appointmentRequested: payload.appointment_requested,
        calendarEventId,
        googleSheets: sheets,
        humanReviewRequired: payload.human_review_required,
      },
    })

    if (advisorId) {
      await createNotification({
        organizationId,
        userId: advisorId,
        type: "CALL_RECEIVED",
        priority: "HIGH",
        title: "Résumé d’appel RetellAI prêt",
        message: `${updatedLead.firstName} ${updatedLead.lastName}: ${nextAction}`,
        actionLabel: "Ouvrir",
        actionUrl: `/prospects/${lead.id}`,
        leadId: lead.id,
      })

      const actionUrl = `/prospects/${lead.id}`
      const aiBrief = await generateAdvisorCallBrief({
        organizationId,
        advisorId,
        callerName: `${updatedLead.firstName} ${updatedLead.lastName}`,
        callerPhone: updatedLead.phone,
        summary,
        transcript: payload.transcript ?? null,
        nextAction,
        urgency: payload.urgency_level ?? null,
        actionUrl,
      })
      const text = [
        aiBrief.title,
        "",
        `Client: ${updatedLead.firstName} ${updatedLead.lastName}`,
        `Téléphone: ${updatedLead.phone}`,
        payload.insurance_category ? `Catégorie: ${payload.insurance_category}` : null,
        payload.qualification_status ? `Qualification: ${payload.qualification_status}` : null,
        score !== null ? `Score: ${score}/100` : null,
        payload.urgency_level ? `Urgence: ${payload.urgency_level}` : null,
        availabilities ? `Disponibilités: ${availabilities}` : null,
        "",
        "Résumé IA:",
        aiBrief.brief,
        "",
        "Résumé RetellAI:",
        summary,
        "",
        "Prochaine action:",
        aiBrief.nextAction || nextAction,
        "",
        "Lien dossier:",
        `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""}${actionUrl}`,
        "",
        "Important: valider les informations avant toute recommandation.",
      ].filter(Boolean).join("\n")

      await sendAdvisorCallEmailAndSms({
        organizationId,
        advisorId,
        leadId: lead.id,
        toEmail: payload.advisor_email,
        subject: "Nouveau prospect assurance - résumé d’appel",
        text,
        smsBody: aiBrief.sms,
      })
    }

    return ok({
      leadId: lead.id,
      callId: call.id,
      taskId: task.id,
      calendarEventId,
      googleSheets: sheets,
      organizationId,
      advisorId,
      advisorEmail: payload.advisor_email ?? null,
      firstName: updatedLead.firstName,
      lastName: updatedLead.lastName,
      phoneNumber: updatedLead.phone,
      summary,
      nextAction,
      status: updatedLead.status,
      priority: updatedLead.priority,
      qualificationScore: score,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
