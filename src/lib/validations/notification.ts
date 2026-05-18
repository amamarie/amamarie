import { NotificationPriority, NotificationStatus, NotificationType } from "@prisma/client"
import { z } from "zod"

const optionalId = z.string().trim().min(1).optional()
const optionalNullableId = z.string().trim().min(1).nullable().optional()

const booleanQuerySchema = z.preprocess((value) => {
  if (value === "true") return true
  if (value === "false") return false
  return value
}, z.boolean())

export const notificationQuerySchema = z.object({
  status: z.nativeEnum(NotificationStatus).optional(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  type: z.nativeEnum(NotificationType).optional(),
  isRead: booleanQuerySchema.optional(),
  userId: optionalId,
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const createNotificationSchema = z.object({
  userId: optionalNullableId,
  type: z.nativeEnum(NotificationType).default("SYSTEM"),
  priority: z.nativeEnum(NotificationPriority).default("NORMAL"),
  status: z.nativeEnum(NotificationStatus).default("UNREAD"),
  title: z.string().trim().min(2).max(180),
  message: z.string().trim().min(1).max(1000),
  actionLabel: z.string().trim().max(80).nullable().optional(),
  actionUrl: z.string().trim().max(500).nullable().optional(),
  href: z.string().trim().max(500).nullable().optional(),
  entityType: z.string().trim().max(80).nullable().optional(),
  entityId: optionalNullableId,
  clientId: optionalNullableId,
  leadId: optionalNullableId,
  taskId: optionalNullableId,
  documentId: optionalNullableId,
  productId: optionalNullableId,
  alertId: optionalNullableId,
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const markReadSchema = z.object({
  readAt: z.coerce.date().optional(),
})

export const dismissNotificationSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export const archiveNotificationSchema = z.object({
  reason: z.string().trim().max(500).optional(),
})

export type NotificationQueryInput = z.infer<typeof notificationQuerySchema>
export type CreateNotificationInput = z.input<typeof createNotificationSchema>
