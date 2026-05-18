import { prisma } from "@/lib/prisma"

export const DEFAULT_ADVISOR_GREETING =
  "Bonjour {{first_name}}, je suis l'assistant vocal du cabinet. Je vous appelle pour preparer votre echange avec {{advisor_name}}. Est-ce toujours un bon moment ?"

export const DEFAULT_ADVISOR_SMS_NOTICE =
  "Bonjour {{first_name}}, merci pour votre demande. Notre assistant vocal vous appellera sous peu afin de preparer votre echange avec {{advisor_name}}."

const DEFAULT_TONE = "professionnel_chaleureux"
const DEFAULT_LANGUAGE = "fr-CA"
const DEFAULT_DELAY_MINUTES = 5
const DEFAULT_AVAILABILITY = "heures_ouvrables"
const DEFAULT_QUALIFICATION_TYPE = "assurance_et_planification"

type AdvisorVoiceSettingsInput = {
  organizationId: string
  userId: string
}

type AdvisorVoiceVariablesInput = AdvisorVoiceSettingsInput & {
  advisorName?: string | null
  firstName?: string | null
  lastName?: string | null
  bookingLink?: string | null
  advisorSpecialties?: string | null
}

export type AdvisorVoiceAutomationSettingsPayload = {
  id: string
  isEnabled: boolean
  greetingMessage: string
  smsNotice: string
  tone: string
  language: string
  callDelayMinutes: number
  availabilityPreference: string
  qualificationType: string
  bookingLink: string
  specialties: string
  customInstructions: string
}

export function clampCallDelayMinutes(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_DELAY_MINUTES
  return Math.min(60, Math.max(0, Math.round(numeric)))
}

function cleanString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

export function renderAdvisorVoiceTemplate(template: string, variables: Record<string, string | null | undefined>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => variables[key] ?? "")
}

export function serializeAdvisorVoiceAutomationSettings(settings: {
  id: string
  isEnabled: boolean
  greetingMessage: string
  smsNotice: string
  tone: string
  language: string
  callDelayMinutes: number
  availabilityPreference: string
  qualificationType: string
  bookingLink: string | null
  specialties: string | null
  customInstructions: string | null
}): AdvisorVoiceAutomationSettingsPayload {
  return {
    id: settings.id,
    isEnabled: settings.isEnabled,
    greetingMessage: settings.greetingMessage,
    smsNotice: settings.smsNotice,
    tone: settings.tone,
    language: settings.language,
    callDelayMinutes: clampCallDelayMinutes(settings.callDelayMinutes),
    availabilityPreference: settings.availabilityPreference,
    qualificationType: settings.qualificationType,
    bookingLink: settings.bookingLink ?? "",
    specialties: settings.specialties ?? "",
    customInstructions: settings.customInstructions ?? "",
  }
}

export async function ensureAdvisorVoiceAutomationSettings({ organizationId, userId }: AdvisorVoiceSettingsInput) {
  return prisma.advisorVoiceAutomationSettings.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    create: {
      organizationId,
      userId,
      greetingMessage: DEFAULT_ADVISOR_GREETING,
      smsNotice: DEFAULT_ADVISOR_SMS_NOTICE,
      tone: DEFAULT_TONE,
      language: DEFAULT_LANGUAGE,
      callDelayMinutes: DEFAULT_DELAY_MINUTES,
      availabilityPreference: DEFAULT_AVAILABILITY,
      qualificationType: DEFAULT_QUALIFICATION_TYPE,
    },
    update: {},
  })
}

export async function getAdvisorVoiceAutomationVariables(input: AdvisorVoiceVariablesInput) {
  const settings = await ensureAdvisorVoiceAutomationSettings(input)
  const variables = {
    first_name: cleanString(input.firstName, "client"),
    last_name: cleanString(input.lastName),
    advisor_name: cleanString(input.advisorName, "un conseiller"),
    advisor_booking_link: cleanString(settings.bookingLink ?? input.bookingLink),
    advisor_specialties: cleanString(settings.specialties ?? input.advisorSpecialties),
  }

  const advisorGreeting = renderAdvisorVoiceTemplate(settings.greetingMessage || DEFAULT_ADVISOR_GREETING, variables)
  const advisorSmsNotice = renderAdvisorVoiceTemplate(settings.smsNotice || DEFAULT_ADVISOR_SMS_NOTICE, variables)

  return {
    settings,
    payload: serializeAdvisorVoiceAutomationSettings(settings),
    retellVariables: {
      advisor_voice_enabled: settings.isEnabled,
      advisor_greeting: advisorGreeting,
      advisor_sms_notice: advisorSmsNotice,
      advisor_tone: settings.tone || DEFAULT_TONE,
      advisor_language: settings.language || DEFAULT_LANGUAGE,
      advisor_call_delay_minutes: clampCallDelayMinutes(settings.callDelayMinutes),
      advisor_availability: settings.availabilityPreference || DEFAULT_AVAILABILITY,
      advisor_qualification_type: settings.qualificationType || DEFAULT_QUALIFICATION_TYPE,
      advisor_booking_link: variables.advisor_booking_link,
      advisor_specialties: variables.advisor_specialties,
      advisor_custom_instructions: cleanString(settings.customInstructions),
    },
  }
}
