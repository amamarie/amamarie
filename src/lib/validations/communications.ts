import { z } from "zod"

const optionalId = z.string().min(1).optional()
const phoneSchema = z.string().min(8, "Le numéro de téléphone est requis.").max(32)

export const sendSmsSchema = z.object({
  to: phoneSchema,
  body: z.string().trim().min(1, "Le message est requis.").max(1000, "Le SMS ne peut pas dépasser 1000 caractères."),
  leadId: optionalId,
  clientId: optionalId,
  isMarketing: z.boolean().optional().default(false),
}).refine((data) => !(data.leadId && data.clientId), {
  message: "Associez le SMS à un client ou à un prospect, pas les deux.",
  path: ["clientId"],
})

export const twilioIncomingSmsSchema = z.object({
  From: phoneSchema,
  To: phoneSchema,
  Body: z.string().max(2000).default(""),
  MessageSid: z.string().min(1),
})

export const twilioIncomingCallSchema = z.object({
  From: phoneSchema,
  To: phoneSchema,
  CallSid: z.string().min(1),
  CallStatus: z.string().optional(),
})

export const callStatusSchema = z.object({
  CallSid: z.string().min(1),
  CallStatus: z.string().optional(),
  CallDuration: z.string().optional(),
  RecordingUrl: z.string().optional(),
})

export const voicemailSchema = z.object({
  CallSid: z.string().min(1),
  From: phoneSchema.optional(),
  To: phoneSchema.optional(),
  RecordingSid: z.string().optional(),
  RecordingUrl: z.string().optional(),
  RecordingDuration: z.string().optional(),
})

export const smsStatusSchema = z.object({
  MessageSid: z.string().min(1),
  MessageStatus: z.string().optional(),
  SmsStatus: z.string().optional(),
  ErrorCode: z.string().optional(),
  ErrorMessage: z.string().optional(),
})

export const communicationsQuerySchema = z.object({
  clientId: optionalId,
  leadId: optionalId,
  advisorId: optionalId,
  status: z.string().optional(),
  direction: z.enum(["INBOUND", "OUTBOUND"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const communicationSettingsSchema = z.object({
  twilioPhoneNumber: z.string().trim().max(32).optional().nullable(),
  advisorSmsNotificationNumber: z.string().trim().max(32).optional().nullable(),
  twilioAccountSid: z.string().trim().max(64).optional().nullable(),
  twilioAuthToken: z.string().trim().max(128).optional().nullable(),
  twilioSubaccountName: z.string().trim().max(120).optional().nullable(),
  twilioMode: z.enum(["PLATFORM", "SUBACCOUNT"]).optional(),
  autoReplyEnabled: z.coerce.boolean().optional(),
  defaultAdvisorId: optionalId.nullable(),
  inboundCallAutoCreateLead: z.coerce.boolean().optional(),
  inboundSmsAutoCreateLead: z.coerce.boolean().optional(),
  defaultSmsReply: z.string().trim().min(1).max(500).optional(),
  autoTranscribeCalls: z.coerce.boolean().optional(),
  autoGenerateCallSummary: z.coerce.boolean().optional(),
  transcriptionLanguage: z.enum(["fr", "en"]).optional(),
})
