import { z } from "zod"

export const financialProductCategorySchema = z.enum(["INSURANCE", "INVESTMENT", "OTHER"])

export const financialProductTypeSchema = z.enum([
  "LIFE_INSURANCE",
  "DISABILITY_INSURANCE",
  "CRITICAL_ILLNESS",
  "HEALTH_INSURANCE",
  "GROUP_INSURANCE",
  "LONG_TERM_CARE",
  "TRAVEL_INSURANCE",
  "OTHER_INSURANCE",
  "RRSP",
  "TFSA",
  "RESP",
  "FHSA",
  "NON_REGISTERED",
  "INVESTMENT",
  "MUTUAL_FUND",
  "SEGREGATED_FUND",
  "GIC",
  "ANNUITY",
  "OTHER_INVESTMENT",
  "OTHER",
])

export const financialProductStatusSchema = z.enum([
  "ACTIVE",
  "PENDING",
  "UNDER_REVIEW",
  "LAPSED",
  "CANCELLED",
  "EXPIRED",
  "TRANSFERRED",
  "ARCHIVED",
])

export const paymentFrequencySchema = z.enum([
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "SEMI_ANNUAL",
  "ANNUAL",
  "ONE_TIME",
  "IRREGULAR",
  "UNKNOWN",
])

export const commissionTypeSchema = z.enum([
  "FIRST_YEAR",
  "RENEWAL",
  "TRAILER",
  "FLAT",
  "UNKNOWN",
])

const optionalString = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().trim().optional()
)

const optionalDate = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.date().optional()
)

const optionalPositiveNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().nonnegative("Le montant ne peut pas être négatif.").optional()
)

const optionalFrequency = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  paymentFrequencySchema.optional()
)

export const createFinancialProductSchema = z.object({
    clientId: z.string().min(1, "Le client est requis."),
    advisorId: optionalString,
    category: financialProductCategorySchema,
    type: financialProductTypeSchema,
    status: financialProductStatusSchema.default("PENDING"),
    company: optionalString,
    productName: optionalString,
    policyNumber: optionalString,
    contractNumber: optionalString,
    accountNumber: optionalString,
    premium: optionalPositiveNumber,
    premiumFrequency: optionalFrequency,
    coverageAmount: optionalPositiveNumber,
    accountValue: optionalPositiveNumber,
    contributionAmount: optionalPositiveNumber,
    contributionFrequency: optionalFrequency,
    commissionAmount: optionalPositiveNumber,
    commissionType: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      commissionTypeSchema.optional()
    ),
    currency: z.string().trim().min(1).default("CAD"),
    primaryBeneficiary: optionalString,
    contingentBeneficiary: optionalString,
    beneficiaryNotes: optionalString,
    issuedAt: optionalDate,
    effectiveDate: optionalDate,
    renewalAt: optionalDate,
    maturityAt: optionalDate,
    cancellationAt: optionalDate,
    lastReviewAt: optionalDate,
    nextReviewAt: optionalDate,
    documentStatus: optionalString,
    missingDocuments: optionalString,
    complianceNotes: optionalString,
    notes: optionalString,
  })

export const updateFinancialProductSchema = createFinancialProductSchema.partial()

export const financialProductFiltersSchema = z.object({
  clientId: z.string().optional(),
  category: financialProductCategorySchema.optional(),
  type: financialProductTypeSchema.optional(),
  status: financialProductStatusSchema.optional(),
  company: z.string().optional(),
  renewalSoon: z.enum(["30", "60", "90"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
})
