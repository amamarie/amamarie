import { z } from "zod"

const optionalString = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().trim().optional()
)

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.date().optional()
)

export const noteTypeSchema = z.enum([
  "GENERAL",
  "MEETING",
  "CALL",
  "SMS",
  "EMAIL",
  "COMPLIANCE",
  "INTERNAL",
  "FOLLOW_UP",
  "PRODUCT",
  "KYC",
  "DOCUMENT",
  "OTHER",
])

export const noteVisibilitySchema = z.enum(["PRIVATE", "TEAM", "COMPLIANCE_ONLY"])
export const noteStatusSchema = z.enum(["ACTIVE", "PINNED", "ARCHIVED", "DELETED"])

const noteBaseSchema = z.object({
  leadId: optionalString,
  clientId: optionalString,
  taskId: optionalString,
  productId: optionalString,
  title: optionalString,
  content: z.string().trim().min(2, "La note doit contenir au moins 2 caractères.").max(10000, "La note ne peut pas dépasser 10 000 caractères."),
  type: noteTypeSchema.default("GENERAL"),
  visibility: noteVisibilitySchema.default("TEAM"),
  status: noteStatusSchema.default("ACTIVE"),
  isPinned: z.boolean().optional().default(false),
  isSensitive: z.boolean().optional().default(false),
  meetingDate: optionalDate,
  followUpDate: optionalDate,
})

export const createNoteSchema = noteBaseSchema.refine((data) => !data.followUpDate || data.followUpDate > new Date(), {
    path: ["followUpDate"],
    message: "La date de suivi doit être dans le futur.",
  })

export const updateNoteSchema = noteBaseSchema.partial().refine(
  (data) => !data.followUpDate || data.followUpDate > new Date(),
  {
    path: ["followUpDate"],
    message: "La date de suivi doit être dans le futur.",
  }
)

export const noteQuerySchema = z.object({
  search: optionalString,
  clientId: optionalString,
  leadId: optionalString,
  taskId: optionalString,
  productId: optionalString,
  type: noteTypeSchema.optional(),
  visibility: noteVisibilitySchema.optional(),
  status: noteStatusSchema.optional(),
  isPinned: z
    .preprocess((value) => (value === "true" ? true : value === "false" ? false : undefined), z.boolean().optional()),
  createdBy: optionalString,
  dateFrom: optionalDate,
  dateTo: optionalDate,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
})
