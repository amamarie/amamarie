import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { invokeWorkflow } from "@/lib/automation/workflows"
import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { getAdvisorVoiceAutomationVariables } from "@/lib/retell/advisor-voice-settings"
import { buildRetellConversationMemory } from "@/lib/retell/conversation-memory"
import { getTenantContext } from "@/lib/tenant"
import { normalizePhoneNumber } from "@/lib/twilio/phone"

type RouteContext = { params: Promise<{ id: string }> }

const startVoiceQualificationSchema = z.object({
  consentToCall: z.boolean(),
  consentToRecording: z.boolean().default(false),
  preferredLanguage: z.string().default("fr"),
  province: z.string().default("QC"),
  insuranceCategory: z.string().optional(),
  insuranceGoal: z.string().optional(),
})

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const { organizationId, userId, role } = await getTenantContext()
    const payload = startVoiceQualificationSchema.parse(await request.json().catch(() => ({})))

    if (!payload.consentToCall) {
      return fail("CONSENT_TO_CALL_REQUIRED", "Le consentement d’appel est requis avant de lancer la qualification vocale.", 422)
    }

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId },
      include: { advisor: { select: { id: true, name: true, email: true, specialties: true } } },
    })
    if (!lead) return fail("LEAD_NOT_FOUND", "Prospect introuvable.", 404)
    if (role === "ADVISOR" && lead.advisorId && lead.advisorId !== userId) {
      return fail("VOICE_AGENT_FORBIDDEN", "Vous ne pouvez pas utiliser l’agent vocal d’un autre conseiller.", 403)
    }

    const phone = normalizePhoneNumber(lead.phone)
    if (!phone || !phone.startsWith("+")) {
      return fail("PHONE_E164_REQUIRED", "Le numéro doit être au format E.164, par exemple +15145551234.", 422)
    }

    const advisor = lead.advisor ?? await prisma.user.findFirst({
      where: { id: userId ?? undefined, organizationId },
      select: { id: true, name: true, email: true, specialties: true },
    })
    if (!advisor) return fail("ADVISOR_NOT_FOUND", "Aucun conseiller assigné au prospect.", 422)

    const voiceSettings = await getAdvisorVoiceAutomationVariables({
      organizationId,
      userId: advisor.id,
      advisorName: advisor.name,
      firstName: lead.firstName,
      lastName: lead.lastName,
      advisorSpecialties: advisor.specialties,
    })
    if (!voiceSettings.settings.isEnabled) {
      return fail("VOICE_AGENT_DISABLED", "Activez l’agent vocal dans Mes paramètres d’agent vocal avant de lancer la qualification.", 409)
    }

    const memory = await buildRetellConversationMemory({
      organizationId,
      leadId: lead.id,
      phoneNumber: phone,
    })

    const result = await invokeWorkflow({
      workflowKey: "assurance.phone_agent",
      required: true,
      input: {
        organizationId,
        userId: advisor.id,
        trigger: "LEAD_CREATED",
        entityType: "lead",
        entityId: lead.id,
        leadId: lead.id,
        payload: {
          prospect_id: lead.id,
          advisor_id: advisor.id,
          advisor_name: advisor.name ?? "Conseiller",
          advisor_email: advisor.email ?? "",
          firstName: lead.firstName,
          lastName: lead.lastName,
          first_name: lead.firstName,
          last_name: lead.lastName,
          phone,
          phone_number: phone,
          email: lead.email ?? "",
          preferred_language: voiceSettings.retellVariables.advisor_language || payload.preferredLanguage,
          province: payload.province,
          interestType: lead.interestType ?? "",
          interest_type: lead.interestType ?? "",
          insurance_category: payload.insuranceCategory ?? lead.interestType ?? voiceSettings.retellVariables.advisor_qualification_type,
          insurance_goal: payload.insuranceGoal ?? lead.nextAction ?? lead.notes ?? "",
          source: lead.source,
          consent: payload.consentToCall,
          consent_to_call: payload.consentToCall,
          consent_to_recording: payload.consentToRecording,
          conversation_memory: memory.conversation_memory,
          previous_topics: memory.previous_topics,
          last_call_summary: memory.last_call_summary,
          open_tasks: memory.open_tasks,
          ...voiceSettings.retellVariables,
        },
      },
      params: {
        consent_to_call: payload.consentToCall,
        consent_to_recording: payload.consentToRecording,
        call_delay_minutes: voiceSettings.retellVariables.advisor_call_delay_minutes,
      },
    })

    await prisma.lead.updateMany({
      where: { id: lead.id, organizationId },
      data: {
        nextAction: "Qualification vocale RetellAI lancée. Réviser le résumé après l’appel.",
        lastContactAt: new Date(),
      },
    })

    await createCrmActivity({
      organizationId,
      userId: advisor.id,
      leadId: lead.id,
      type: "AUTOMATION_EXECUTED",
      title: "Qualification vocale RetellAI lancée",
      description: `Workflow n8n assurance.phone_agent déclenché pour ${lead.firstName} ${lead.lastName}.`,
      source: "AUTOMATION",
      entityType: "Lead",
      entityId: lead.id,
      metadata: { workflowKey: "assurance.phone_agent", workflowResult: result },
    })

    return ok({ started: true, workflow: result })
  } catch (error) {
    return handleApiError(error)
  }
}
