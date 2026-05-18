import { z } from "zod"

export const crossSellCategorySchema = z.enum([
  "PROTECTION",
  "INVESTMENT",
  "FAMILY_NEEDS",
  "RETIREMENT",
  "TAX_EFFICIENCY",
  "BUSINESS_OWNER",
  "REVIEW_OPPORTUNITY",
])

export const crossSellPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"])

export const crossSellStatusSchema = z.enum([
  "OPEN",
  "REVIEWED",
  "DISMISSED",
  "CONVERTED_TO_TASK",
  "DISCUSSED",
  "WON",
  "LOST",
  "ARCHIVED",
])

export const crossSellFiltersSchema = z.object({
  category: crossSellCategorySchema.optional(),
  priority: crossSellPrioritySchema.optional(),
  status: crossSellStatusSchema.optional(),
  clientId: z.string().optional(),
  advisorId: z.string().optional(),
})

export const dismissCrossSellSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export const markDiscussedSchema = z.object({
  discussedAt: z.coerce.date().optional(),
  note: z.string().trim().max(1000).optional(),
})

export const markWonSchema = z.object({
  productId: z.string().optional(),
  note: z.string().trim().max(1000).optional(),
})

export const markLostSchema = z.object({
  reason: z.string().trim().min(1, "La raison est requise."),
  note: z.string().trim().max(1000).optional(),
})

export const convertCrossSellToTaskSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  dueDate: z.coerce.date().optional(),
  assignedToId: z.string().min(1).optional(),
})
