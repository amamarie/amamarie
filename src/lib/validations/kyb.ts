import { z } from "zod"

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional()
)
const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.date().optional()
)
const optionalNumber = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().min(0).optional()
)
const optionalInt = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().int().min(0).optional()
)
const optionalBoolean = z.preprocess((value) => {
  if (value === "" || value === null || typeof value === "undefined") return undefined
  if (value === "true" || value === true) return true
  if (value === "false" || value === false) return false
  return value
}, z.boolean().optional())

export const kybStatusSchema = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "PENDING_DOCUMENTS",
  "PENDING_REVIEW",
  "APPROVED",
  "NEEDS_UPDATE",
  "EXPIRED",
  "REJECTED",
  "ARCHIVED",
])

export const kybSubjectTypeSchema = z.enum([
  "BUSINESS",
  "TRUST",
  "ESTATE",
  "NON_PROFIT",
  "OTHER",
])

const kybProfileBaseSchema = z.object({
  status: kybStatusSchema.default("IN_PROGRESS"),
  subjectType: kybSubjectTypeSchema.default("BUSINESS"),
  legalName: optionalText,
  tradeName: optionalText,
  entityType: optionalText,
  jurisdiction: optionalText,
  registrationNumber: optionalText,
  taxNumber: optionalText,
  incorporationDate: optionalDate,
  headOfficeAddress: optionalText,
  operatingAddress: optionalText,
  businessActivity: optionalText,
  industry: optionalText,
  website: optionalText,
  annualRevenue: optionalNumber,
  netProfit: optionalNumber,
  employeeCount: optionalInt,
  cashIntensiveBusiness: optionalBoolean,
  internationalActivity: optionalBoolean,
  regulatedActivity: optionalBoolean,
  directorsDocumented: optionalBoolean,
  shareholdersDocumented: optionalBoolean,
  beneficialOwnersDocumented: optionalBoolean,
  authorizedSignersDocumented: optionalBoolean,
  corporateDocumentsCollected: optionalBoolean,
  ownershipStructureNotes: optionalText,
  authorizedSignersNotes: optionalText,
  beneficialOwnersNotes: optionalText,
  sourceOfFunds: optionalText,
  sourceOfWealth: optionalText,
  amlRiskLevel: optionalText,
  reviewNotes: optionalText,
  nextReviewAt: optionalDate,
})

export const kybProfileSchema = kybProfileBaseSchema.superRefine((data, ctx) => {
  if (data.status === "APPROVED" && !data.beneficialOwnersDocumented) {
    ctx.addIssue({
      code: "custom",
      path: ["beneficialOwnersDocumented"],
      message: "Les bénéficiaires effectifs doivent être documentés avant d’approuver un KYB.",
    })
  }
})

export const updateKybProfileSchema = kybProfileBaseSchema.partial().superRefine((data, ctx) => {
  if (data.status === "APPROVED" && data.beneficialOwnersDocumented === false) {
    ctx.addIssue({
      code: "custom",
      path: ["beneficialOwnersDocumented"],
      message: "Les bénéficiaires effectifs doivent être documentés avant d’approuver un KYB.",
    })
  }
})
