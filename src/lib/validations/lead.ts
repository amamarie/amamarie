import { z } from "zod"

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional()
)

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.date().optional()
)

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().email("Courriel invalide").optional()
)

export const leadSourceSchema = z.enum([
  "INBOUND_CALL",
  "SMS",
  "WEBSITE",
  "REFERRAL",
  "SOCIAL_MEDIA",
  "EVENT",
  "MANUAL",
  "CAMPAIGN",
  "OTHER",
])

export const leadStatusSchema = z.enum([
  "NEW",
  "TO_CONTACT",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "CONVERTED",
  "LOST",
  "ARCHIVED",
])

export const prioritySchema = z.enum(["LOW", "NORMAL", "HIGH", "URGENT"])

export const createLeadSchema = z.object({
  firstName: z.string().min(1, "Le prenom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  phone: z.string().min(7, "Le telephone est requis"),
  email: optionalEmail,
  address: optionalText,
  source: leadSourceSchema.default("MANUAL"),
  status: leadStatusSchema.default("NEW"),
  priority: prioritySchema.default("NORMAL"),
  interestType: optionalText,
  nextAction: optionalText,
  notes: optionalText,
  lostReason: optionalText,
  lostNote: optionalText,
  lostAt: optionalDate,
  advisorId: optionalText,
  lastContactAt: optionalDate,
})

export const updateLeadSchema = createLeadSchema.partial()
