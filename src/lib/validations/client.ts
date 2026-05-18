import { z } from "zod"

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional()
)

const optionalEmail = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value
    const email = value.trim().toLowerCase()
    return email === "" ? undefined : email
  },
  z.string().email("Courriel invalide").optional()
)

const phoneAllowedCharacters = /^[0-9+\s().-]+$/

export function normalizeClientPhone(value?: unknown) {
  if (typeof value !== "string") return undefined
  const raw = value.trim()
  if (!raw) return undefined
  if (!phoneAllowedCharacters.test(raw)) {
    throw new Error("Le téléphone ne doit contenir que des chiffres, espaces, +, parenthèses, points ou tirets.")
  }
  const digits = raw.replace(/\D/g, "")
  if (!(digits.length === 10 || (digits.length === 11 && digits.startsWith("1")))) {
    throw new Error("Le téléphone doit contenir 10 chiffres, ou 11 chiffres avec l'indicatif 1.")
  }
  return digits
}

export function assertClientPhoneFormats(payload: Record<string, unknown>) {
  const phoneFields = ["phone", "phonePrimary", "phoneSecondary"]
  for (const field of phoneFields) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === "") continue
    normalizeClientPhone(payload[field])
  }
}

const requiredPhone = z.preprocess(
  (value) => normalizeClientPhone(value),
  z.string()
)

const optionalPhone = z.preprocess(
  (value) => normalizeClientPhone(value),
  z.string().optional()
)

const optionalDate = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.date().optional()
)

const optionalInt = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().int().min(0).optional()
)

const optionalNumber = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().min(0).optional()
)

const optionalBoolean = z.preprocess(
  (value) => {
    if (value === "" || value === null || typeof value === "undefined") return undefined
    if (value === "true" || value === true) return true
    if (value === "false" || value === false) return false
    return value
  },
  z.boolean().optional()
)

function optionalEnum<T extends [string, ...string[]]>(values: T) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.enum(values).optional()
  )
}

const clientChildSchema = z.object({
  name: optionalText,
  dateOfBirth: optionalText,
  gender: optionalText,
  age: optionalInt,
})

const optionalChildren = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value
    if (value.trim() === "") return undefined
    try {
      return JSON.parse(value)
    } catch {
      return undefined
    }
  },
  z.array(clientChildSchema).optional()
)

export const clientStatusSchema = z.enum([
  "ACTIVE",
  "INACTIVE",
  "PROSPECT_CONVERTED",
  "REVIEW_NEEDED",
  "ARCHIVED",
])

export const clientProfileTypeSchema = z.enum([
  "INDIVIDUAL",
  "BUSINESS",
  "TRUST",
  "ESTATE",
  "HOUSEHOLD",
  "NON_PROFIT",
  "OTHER",
])

export const riskProfileSchema = z.enum([
  "CONSERVATIVE",
  "MODERATE",
  "BALANCED",
  "GROWTH",
  "AGGRESSIVE",
  "UNKNOWN",
])

export const familyStatusSchema = z.enum([
  "SINGLE",
  "MARRIED",
  "COMMON_LAW",
  "DIVORCED",
  "WIDOWED",
  "OTHER",
])

export const employmentStatusSchema = z.enum([
  "EMPLOYED",
  "SELF_EMPLOYED",
  "BUSINESS_OWNER",
  "INCORPORATED",
  "UNEMPLOYED",
  "RETIRED",
  "STUDENT",
  "OTHER",
])

export const preferredContactMethodSchema = z.enum(["PHONE", "EMAIL", "SMS"])
export const preferredContactTimeSchema = z.enum(["MORNING", "AFTERNOON", "EVENING"])
export const primaryGoalSchema = z.enum([
  "RETIREMENT",
  "WEALTH_BUILDING",
  "PROTECTION",
  "TAX_OPTIMIZATION",
  "EDUCATION",
  "BUSINESS_PROTECTION",
  "ESTATE_PLANNING",
  "OTHER",
])
export const investmentHorizonSchema = z.enum(["SHORT_TERM", "MEDIUM_TERM", "LONG_TERM"])

export const createClientSchema = z.object({
  firstName: z.string().min(1, "Le prenom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  clientNumber: optionalText,
  gender: optionalText,
  phone: optionalPhone,
  phonePrimary: requiredPhone,
  phoneSecondary: optionalPhone,
  email: optionalEmail,
  emailPrimary: optionalEmail,
  emailSecondary: optionalEmail,
  preferredContactMethod: optionalEnum(["PHONE", "EMAIL", "SMS"]),
  preferredContactTime: optionalEnum(["MORNING", "AFTERNOON", "EVENING"]),
  address: optionalText,
  addressLine1: optionalText,
  addressLine2: optionalText,
  city: optionalText,
  province: optionalText,
  postalCode: optionalText,
  country: optionalText,
  dateOfBirth: optionalDate,
  occupation: optionalText,
  employer: optionalText,
  employmentStatus: optionalEnum(["EMPLOYED", "SELF_EMPLOYED", "BUSINESS_OWNER", "INCORPORATED", "UNEMPLOYED", "RETIRED", "STUDENT", "OTHER"]),
  yearsAtJob: optionalInt,
  incomeRange: optionalText,
  isSelfEmployed: optionalBoolean,
  annualIncome: optionalInt,
  profileType: clientProfileTypeSchema.default("INDIVIDUAL"),
  approximateIncome: optionalInt,
  familyStatus: optionalEnum(["SINGLE", "MARRIED", "COMMON_LAW", "DIVORCED", "WIDOWED", "OTHER"]),
  dependents: optionalInt,
  dependentsCount: optionalInt,
  dependentsDetails: optionalText,
  hasChildren: optionalBoolean,
  spouseName: optionalText,
  spouseGender: optionalText,
  spouseDateOfBirth: optionalDate,
  children: optionalChildren,
  advisorId: optionalText,
  status: clientStatusSchema.default("ACTIVE"),
  riskProfile: riskProfileSchema.default("UNKNOWN"),
  netWorth: optionalNumber,
  liquidAssets: optionalNumber,
  liabilities: optionalNumber,
  savingsRate: optionalNumber,
  financialGoals: optionalText,
  goals: optionalText,
  primaryGoal: optionalEnum(["RETIREMENT", "WEALTH_BUILDING", "PROTECTION", "TAX_OPTIMIZATION", "EDUCATION", "BUSINESS_PROTECTION", "ESTATE_PLANNING", "OTHER"]),
  investmentHorizon: optionalEnum(["SHORT_TERM", "MEDIUM_TERM", "LONG_TERM"]),
  retirementGoal: optionalBoolean,
  protectionNeeds: optionalBoolean,
  source: optionalText,
  referredBy: optionalText,
  relationshipStartDate: optionalDate,
  lastContactAt: optionalDate,
  nextReviewDate: optionalDate,
  lastInteractionType: optionalText,
  lastInteractionDate: optionalDate,
  totalInteractions: optionalInt,
  kycCompleted: optionalBoolean,
  kycDate: optionalDate,
  identityVerified: optionalBoolean,
  complianceStatus: optionalText,
  consentGiven: optionalBoolean,
  notes: optionalText,
})

export const updateClientSchema = createClientSchema.partial()

export const createClientDocumentSchema = z.object({
  name: z.string().min(1, "Le nom du document est requis"),
  type: z.string().min(1, "Le type du document est requis"),
  status: z.enum(["REQUIRED", "RECEIVED", "VALIDATED", "EXPIRED", "PENDING"]).default("RECEIVED"),
  url: optionalText,
})

export { createFinancialProductSchema } from "@/lib/validations/financial-product"
