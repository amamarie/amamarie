import { z } from "zod"

import { runAI } from "@/lib/ai/core/run-ai"
import { AI_COMPLIANCE_DISCLAIMER } from "@/lib/ai/prompts/system"

export const leadIntakeQualificationSchema = z.object({
  temperature: z.enum(["HOT", "WARM", "COLD"]).default("WARM"),
  intent: z
    .enum([
      "BOOK_APPOINTMENT",
      "INSURANCE_NEED",
      "INVESTMENT_NEED",
      "RETIREMENT_PLANNING",
      "DOCUMENT_REQUEST",
      "SERVICE_REQUEST",
      "GENERAL_INQUIRY",
      "UNKNOWN",
    ])
    .default("GENERAL_INQUIRY"),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("HIGH"),
  probableNeed: z.string().min(2).max(220),
  nextBestAction: z.string().min(2).max(220),
  advisorTaskTitle: z.string().min(2).max(140),
  advisorTaskDescription: z.string().min(2).max(500),
  followUpDelayHours: z.number().int().min(1).max(168).default(24),
  clientSms: z.string().min(10).max(320),
  missingData: z.array(z.string().min(2).max(160)).default([]),
  rationale: z.string().min(10).max(700),
  disclaimer: z.string().min(20),
})

export type LeadIntakeQualification = z.infer<typeof leadIntakeQualificationSchema>

type QualifyLeadIntakeInput = {
  organizationId: string
  userId?: string | null
  source: "SMS" | "INBOUND_CALL" | "WEBSITE" | "VOICEMAIL" | "EMAIL" | "GOOGLE_SHEETS"
  lead: {
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    phone?: string | null
    status?: string | null
    priority?: string | null
    interestType?: string | null
    nextAction?: string | null
    notes?: string | null
  }
  message?: string | null
  formName?: string | null
  extraContext?: Record<string, unknown>
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word))
}

function fallbackQualification(input: QualifyLeadIntakeInput): LeadIntakeQualification {
  const text = `${input.message ?? ""} ${input.lead.interestType ?? ""}`.toLowerCase()
  const isAppointment = includesAny(text, ["rdv", "rendez-vous", "rendez vous", "appointment", "disponible", "appel"])
  const isInsurance = includesAny(text, ["assurance", "vie", "invalidité", "maladie grave", "protection", "hypothèque"])
  const isRetirement = includesAny(text, ["retraite", "décaissement", "ferr"])
  const isInvestment = includesAny(text, ["placement", "invest", "reer", "celi", "portefeuille"])
  const isUrgent = includesAny(text, ["urgent", "rapidement", "aujourd'hui", "ce soir", "immédiat", "asap"])
  const hasContact = Boolean(input.lead.phone || input.lead.email)

  const intent: LeadIntakeQualification["intent"] = isAppointment
    ? "BOOK_APPOINTMENT"
    : isInsurance
      ? "INSURANCE_NEED"
      : isRetirement
        ? "RETIREMENT_PLANNING"
      : isInvestment
        ? "INVESTMENT_NEED"
        : input.source === "WEBSITE"
          ? "GENERAL_INQUIRY"
          : "SERVICE_REQUEST"

  const temperature = isUrgent || isAppointment || input.source === "INBOUND_CALL" ? "HOT" : input.source === "WEBSITE" ? "WARM" : "WARM"
  const urgency = isUrgent || input.source === "INBOUND_CALL" ? "URGENT" : isAppointment ? "HIGH" : "HIGH"
  const probableNeed =
    intent === "BOOK_APPOINTMENT"
      ? "Prise de rendez-vous ou rappel à organiser"
      : intent === "INSURANCE_NEED"
        ? "Besoin potentiel de protection à clarifier"
        : intent === "INVESTMENT_NEED" || intent === "RETIREMENT_PLANNING"
          ? "Besoin potentiel de planification ou placement à clarifier"
          : "Demande entrante à qualifier"

  const title = isAppointment ? "Qualifier et proposer un créneau" : input.source === "INBOUND_CALL" ? "Rappeler le nouveau prospect" : "Qualifier le nouveau prospect"
  const missingData = [
    !hasContact ? "Coordonnées à confirmer" : null,
    !input.lead.interestType ? "Type de besoin à préciser" : null,
    !input.message && input.source !== "INBOUND_CALL" ? "Contexte de la demande à documenter" : null,
  ].filter(Boolean) as string[]

  return {
    temperature,
    intent,
    urgency,
    probableNeed,
    nextBestAction: isAppointment ? "Confirmer le besoin et proposer un rendez-vous" : "Contacter le prospect et confirmer le contexte de la demande",
    advisorTaskTitle: title,
    advisorTaskDescription: `Qualification automatique FinAdvisor. Source: ${input.source}. Besoin probable: ${probableNeed}. Validation humaine obligatoire.`,
    followUpDelayHours: urgency === "URGENT" ? 24 : 48,
    clientSms: "Bonjour, merci pour votre demande. Nous l'avons bien reçue et un conseiller vous contactera dès que possible.",
    missingData,
    rationale: "Qualification administrative basée sur la source, le message reçu et les données visibles du prospect. Validation humaine obligatoire.",
    disclaimer: AI_COMPLIANCE_DISCLAIMER,
  }
}

export async function qualifyLeadIntake(input: QualifyLeadIntakeInput) {
  return runAI({
    organizationId: input.organizationId,
    userId: input.userId ?? "system",
    feature: "lead-intake-qualification",
    prompt:
      "Qualifie cette entrée prospect pour un CRM de conseiller financier. Retourne seulement une qualification administrative: température, intention, urgence, besoin probable, prochaine action, tâche conseiller et SMS client neutre. Ne donne aucun conseil financier et ne recommande aucun produit.",
    schema: leadIntakeQualificationSchema,
    context: input,
    fallback: () => fallbackQualification(input),
  })
}
