import { z } from "zod"

import { prioritySchema } from "@/lib/validations/lead"

export const taskTypeSchema = z.enum([
  "CALL",
  "SMS",
  "EMAIL",
  "MEETING",
  "DOCUMENT",
  "KYC",
  "FOLLOW_UP",
  "PRODUCT_REVIEW",
  "RENEWAL",
  "COMPLIANCE",
  "INTERNAL",
  "OTHER",
])

export const taskStatusSchema = z.enum([
  "TODO",
  "IN_PROGRESS",
  "WAITING",
  "DONE",
  "CANCELLED",
  "OVERDUE",
  "SNOOZED",
  "ARCHIVED",
])

const optionalId = z.string().min(1).optional().or(z.literal("").transform(() => undefined))
const optionalDate = z.coerce.date().optional()

export const createTaskSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  outcome: z.string().optional(),
  type: taskTypeSchema.default("FOLLOW_UP"),
  priority: prioritySchema.default("NORMAL"),
  status: taskStatusSchema.default("TODO"),
  dueDate: optionalDate,
  startDate: optionalDate,
  reminderAt: optionalDate,
  assignedToId: optionalId,
  leadId: optionalId,
  clientId: optionalId,
  productId: optionalId,
  alertId: optionalId,
  recommendationId: optionalId,
  crossSellOpportunityId: optionalId,
  isAutomated: z.boolean().optional(),
  automationRuleId: optionalId,
  recurrenceRule: z.string().optional(),
  parentTaskId: optionalId,
})

export const updateTaskSchema = createTaskSchema.partial().extend({
  completedAt: z.coerce.date().nullable().optional(),
  cancelledAt: z.coerce.date().nullable().optional(),
  snoozedUntil: z.coerce.date().nullable().optional(),
  cancelReason: z.string().optional(),
  snoozeReason: z.string().optional(),
})

export const completeTaskSchema = z.object({
  outcome: z.string().optional(),
})

export const cancelTaskSchema = z.object({
  cancelReason: z.string().min(3, "La raison d’annulation est requise."),
})

export const snoozeTaskSchema = z.object({
  snoozedUntil: z.coerce.date().refine((date) => date.getTime() > Date.now(), "La date de report doit être future."),
  snoozeReason: z.string().optional(),
})

export const assignTaskSchema = z.object({
  assignedToId: z.string().min(1, "Le conseiller assigné est requis."),
})

export const taskPrioritySchema = z.object({
  priority: prioritySchema,
})

export const taskStatusUpdateSchema = z.object({
  status: taskStatusSchema,
})

export const taskQuerySchema = z.object({
  search: z.string().optional(),
  status: taskStatusSchema.optional(),
  priority: prioritySchema.optional(),
  type: taskTypeSchema.optional(),
  assignedToId: z.string().optional(),
  clientId: z.string().optional(),
  leadId: z.string().optional(),
  dueDateFrom: z.coerce.date().optional(),
  dueDateTo: z.coerce.date().optional(),
  view: z.enum(["today", "overdue", "upcoming", "automated", "all", "done", "snoozed"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
