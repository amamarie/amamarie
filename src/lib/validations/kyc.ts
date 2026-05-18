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

export const kycStatusSchema = z.enum([
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

export const kycSubjectTypeSchema = z.enum([
  "INDIVIDUAL",
  "BUSINESS",
  "TRUST",
  "ESTATE",
  "HOUSEHOLD",
  "NON_PROFIT",
  "OTHER",
])

const kycProfileBaseSchema = z.object({
    status: kycStatusSchema.default("IN_PROGRESS"),
    subjectType: kycSubjectTypeSchema.default("INDIVIDUAL"),
    legalFirstName: optionalText,
    legalLastName: optionalText,
    preferredName: optionalText,
    dateOfBirth: optionalDate,
    countryOfResidence: optionalText,
    provinceOfResidence: optionalText,
    citizenship: optionalText,
    taxResidency: optionalText,
    sinLast4: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().regex(/^\d{4}$/, "Utiliser seulement les 4 derniers chiffres.").optional()
    ),
    maritalStatus: optionalText,
    dependentsCount: optionalInt,
    politicallyExposedPerson: optionalBoolean,
    pepDetails: optionalText,
    insiderStatus: optionalBoolean,
    insiderCompany: optionalText,
    occupation: optionalText,
    employer: optionalText,
    employmentStatus: optionalText,
    annualIncome: optionalNumber,
    incomeRange: optionalText,
    netWorth: optionalNumber,
    liquidNetWorth: optionalNumber,
    totalAssets: optionalNumber,
    totalLiabilities: optionalNumber,
    monthlyExpenses: optionalNumber,
    emergencyFund: optionalNumber,
    investmentKnowledge: optionalText,
    investmentExperience: optionalText,
    borrowingNeeds: optionalText,
    liquidityNeeds: optionalText,
    taxBracket: optionalText,
    sourceOfWealth: optionalText,
    sourceOfFunds: optionalText,
    primaryObjective: optionalText,
    secondaryObjectives: z.unknown().optional(),
    investmentHorizon: optionalText,
    riskTolerance: optionalText,
    riskCapacity: optionalText,
    riskProfileResult: optionalText,
    timeHorizonYears: optionalInt,
    retirementAgeTarget: optionalInt,
    protectionNeeds: optionalText,
    estatePlanningNeeds: optionalBoolean,
    educationFundingNeeds: optionalBoolean,
    homePurchaseGoal: optionalBoolean,
    taxOptimizationGoal: optionalBoolean,
    riskQuestionnaireCompleted: optionalBoolean,
    riskQuestionnaireScore: optionalInt,
    riskQuestionnaireDate: optionalDate,
    riskProfileNotes: optionalText,
    advisorOverride: optionalBoolean,
    advisorOverrideReason: optionalText,
    financialGoals: optionalText,
    notes: optionalText,
    lastKycReviewAt: optionalDate,
    nextKycReviewAt: optionalDate,
    reviewStatus: optionalText,
    reviewNotes: optionalText,
    changesDetected: optionalBoolean,
    clientConfirmedNoChange: optionalBoolean,
    advisorAttestation: optionalBoolean,
})

function requireOverrideReason(data: { advisorOverride?: boolean; advisorOverrideReason?: string }, ctx: z.RefinementCtx) {
    if (data.advisorOverride && !data.advisorOverrideReason) {
      ctx.addIssue({
        code: "custom",
        path: ["advisorOverrideReason"],
        message: "La justification est requise lorsqu’une dérogation conseiller est utilisée.",
      })
    }
}

export const kycProfileSchema = kycProfileBaseSchema.superRefine(requireOverrideReason)

export const updateKycProfileSchema = kycProfileBaseSchema.partial().superRefine(requireOverrideReason)

export const rejectKycSchema = z.object({
  rejectedReason: z.string().trim().min(1, "La raison du rejet est requise."),
})

export const reviewKycSchema = z.object({
  reviewNotes: optionalText,
  changesDetected: optionalBoolean,
  clientConfirmedNoChange: optionalBoolean,
  advisorAttestation: optionalBoolean,
})

export const snapshotKycSchema = z.object({
  reason: z.enum(["INITIAL_KYC", "ANNUAL_REVIEW", "CLIENT_UPDATE", "ADVISOR_UPDATE", "COMPLIANCE_REVIEW", "CLIENT_PORTAL_CONFIRMATION"]).default("ADVISOR_UPDATE"),
  advisorAttestationAccepted: optionalBoolean,
  clientAccuracyConfirmed: optionalBoolean,
  useForAnalysisOrRecommendation: optionalBoolean,
  sendToClientForConfirmation: optionalBoolean,
})
