import { z } from "zod"

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional()
)
const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.date().optional()
)

export const consentStatusSchema = z.enum([
  "NOT_REQUESTED",
  "REQUESTED",
  "GIVEN",
  "DECLINED",
  "REVOKED",
  "EXPIRED",
])

export const createConsentSchema = z.object({
  type: z.string().trim().min(1, "Le type de consentement est requis."),
  purposeId: optionalText,
  templateId: optionalText,
  status: consentStatusSchema.default("REQUESTED"),
  consentText: optionalText,
  version: optionalText,
  language: optionalText,
  method: optionalText,
  purposeText: optionalText,
  dataCategories: z.unknown().optional(),
  thirdParties: z.unknown().optional(),
  isSensitive: z.boolean().optional(),
  isRequiredForService: z.boolean().optional(),
  withdrawalAllowed: z.boolean().optional(),
  proofDocumentId: optionalText,
  relatedEntityType: optionalText,
  relatedEntityId: optionalText,
  givenAt: optionalDate,
  revokedAt: optionalDate,
  expiresAt: optionalDate,
  notes: optionalText,
})

export const updateConsentSchema = createConsentSchema.partial()

export const revokeConsentSchema = z.object({
  notes: optionalText,
})
