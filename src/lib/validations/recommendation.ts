import { z } from "zod"

export const recommendationTypeSchema = z.enum([
  "PROTECTION",
  "INVESTMENT_REVIEW",
  "COMPLIANCE",
  "FOLLOW_UP",
  "CROSS_SELL_OPPORTUNITY",
  "DATA_QUALITY",
  "LIFE_INSURANCE",
  "DISABILITY_INSURANCE",
  "CRITICAL_ILLNESS",
  "BUSINESS_INSURANCE",
  "REPLACEMENT",
  "INVESTMENT",
  "MAINTAIN",
  "NO_ACTION",
  "CLIENT_DECLINED",
])

export const recommendationPrioritySchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
])

export const recommendationStatusSchema = z.enum([
  "NOT_STARTED",
  "DRAFT",
  "MISSING_DATA",
  "OPTIONS_REQUIRED",
  "OPEN",
  "ADVISOR_REVIEW",
  "REVIEWED",
  "COMPLIANCE_REVIEW_REQUIRED",
  "ADVISOR_APPROVED",
  "COMPLIANCE_APPROVED",
  "PRESENTED_TO_CLIENT",
  "CLIENT_ACCEPTED",
  "CLIENT_DECLINED",
  "SIGNED",
  "USED_FOR_PROPOSAL",
  "LOCKED",
  "NEEDS_UPDATE",
  "DISMISSED",
  "CONVERTED_TO_TASK",
  "COMPLETED",
  "ARCHIVED",
])

export const generateRecommendationsSchema = z.object({
  clientId: z.string().min(1, "Le client est requis.").optional(),
})

export const dismissRecommendationSchema = z.object({
  reason: z.string().trim().max(500, "La raison doit rester courte.").optional(),
})

export const convertRecommendationToTaskSchema = z.object({
  dueDate: z.coerce.date().optional(),
  assignedToId: z.string().min(1).optional(),
  taskTitle: z.string().trim().min(1).max(160).optional(),
})

export const recommendationFiltersSchema = z.object({
  status: recommendationStatusSchema.optional(),
  priority: recommendationPrioritySchema.optional(),
  type: recommendationTypeSchema.optional(),
  clientId: z.string().optional(),
  advisorId: z.string().optional(),
})
