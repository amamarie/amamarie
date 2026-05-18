import { z } from "zod"

export const priorityQuerySchema = z.object({
  status: z.enum(["ACTIVE", "SNOOZED", "DISMISSED", "COMPLETED", "ARCHIVED"]).optional(),
  level: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "BACKLOG"]).optional(),
  entityType: z.enum(["LEAD", "CLIENT", "TASK", "SMART_ALERT", "COMPLIANCE_ALERT", "RECOMMENDATION", "CROSS_SELL", "FINANCIAL_PRODUCT", "DOCUMENT", "APPOINTMENT"]).optional(),
  advisorId: z.string().optional(),
  clientId: z.string().optional(),
  leadId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  page: z.coerce.number().int().min(1).default(1),
})

export const generatePrioritiesSchema = z.object({
  advisorId: z.string().optional(),
})

export const snoozePrioritySchema = z.object({
  snoozedUntil: z.coerce.date().refine((date) => date.getTime() > Date.now(), "La date de report doit être future."),
})

export const dismissPrioritySchema = z.object({
  dismissedReason: z.string().min(3, "Une raison est requise."),
})

export const completePrioritySchema = z.object({})

export const assignPrioritySchema = z.object({
  advisorId: z.string().min(1),
})

export const overridePrioritySchema = z.object({
  level: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "BACKLOG"]),
  reason: z.string().min(3, "Une justification est requise."),
})
