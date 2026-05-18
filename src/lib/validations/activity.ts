import { ActivityType } from "@prisma/client"
import { z } from "zod"

export const activitySourceSchema = z.enum([
  "USER",
  "AUTOMATION",
  "SYSTEM",
  "AI",
  "WEBHOOK",
  "IMPORT",
])

const optionalId = z.string().trim().min(1).optional()

export const activityQuerySchema = z.object({
  clientId: optionalId,
  leadId: optionalId,
  taskId: optionalId,
  documentId: optionalId,
  productId: optionalId,
  type: z.nativeEnum(ActivityType).optional(),
  source: activitySourceSchema.optional(),
  userId: optionalId,
  entityType: z.string().trim().max(80).optional(),
  entityId: optionalId,
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const createActivitySchema = z.object({
  userId: z.string().trim().min(1).nullable().optional(),
  clientId: z.string().trim().min(1).nullable().optional(),
  leadId: z.string().trim().min(1).nullable().optional(),
  taskId: z.string().trim().min(1).nullable().optional(),
  documentId: z.string().trim().min(1).nullable().optional(),
  productId: z.string().trim().min(1).nullable().optional(),
  noteId: z.string().trim().min(1).nullable().optional(),
  alertId: z.string().trim().min(1).nullable().optional(),
  automationRuleId: z.string().trim().min(1).nullable().optional(),
  type: z.nativeEnum(ActivityType),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1000).nullable().optional(),
  entityType: z.string().trim().max(80).nullable().optional(),
  entityId: z.string().trim().min(1).nullable().optional(),
  source: activitySourceSchema.default("USER"),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type ActivityQueryInput = z.infer<typeof activityQuerySchema>
export type CreateActivityInput = z.input<typeof createActivitySchema>
