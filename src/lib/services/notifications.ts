import { Prisma, type NotificationPriority, type NotificationStatus, type NotificationType, type UserRole } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { createActivity } from "@/lib/services/activities"
import { createNotificationSchema, notificationQuerySchema, type CreateNotificationInput } from "@/lib/validations/notification"

type CurrentUser = {
  id: string
  role: UserRole
}

function notificationAccessWhere(organizationId: string, user: CurrentUser) {
  if (user.role === "OWNER") return { organizationId }
  return {
    organizationId,
    OR: [{ userId: user.id }, { userId: null }],
  }
}

function notificationInclude() {
  return {
    user: { select: { id: true, name: true, email: true, role: true } },
  } satisfies Prisma.NotificationInclude
}

function dedupeWhere(organizationId: string, payload: ReturnType<typeof createNotificationSchema.parse>) {
  if (!payload.entityType || !payload.entityId) return null
  return {
    organizationId,
    userId: payload.userId ?? null,
    type: payload.type,
    entityType: payload.entityType,
    entityId: payload.entityId,
    status: "UNREAD" as NotificationStatus,
  }
}

export async function createNotification(input: CreateNotificationInput & { organizationId: string }) {
  const payload = createNotificationSchema.parse(input)
  const duplicateWhere = dedupeWhere(input.organizationId, payload)
  const actionUrl = payload.actionUrl ?? payload.href ?? null

  if (duplicateWhere) {
    const existing = await prisma.notification.findFirst({ where: duplicateWhere })
    if (existing) {
      return prisma.notification.update({
        where: { id: existing.id },
        data: {
          title: payload.title,
          message: payload.message,
          priority: payload.priority,
          actionLabel: payload.actionLabel ?? existing.actionLabel,
          actionUrl: actionUrl ?? existing.actionUrl,
          href: actionUrl ?? existing.href,
          metadata: (payload.metadata ?? existing.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
        include: notificationInclude(),
      })
    }
  }

  const notification = await prisma.notification.create({
    data: {
      organizationId: input.organizationId,
      userId: payload.userId ?? null,
      type: payload.type,
      priority: payload.priority,
      status: payload.status,
      title: payload.title,
      message: payload.message,
      actionLabel: payload.actionLabel ?? null,
      actionUrl,
      href: actionUrl,
      entityType: payload.entityType ?? null,
      entityId: payload.entityId ?? null,
      clientId: payload.clientId ?? null,
      leadId: payload.leadId ?? null,
      taskId: payload.taskId ?? null,
      documentId: payload.documentId ?? null,
      productId: payload.productId ?? null,
      alertId: payload.alertId ?? null,
      isRead: payload.status === "READ",
      readAt: payload.status === "READ" ? new Date() : null,
      metadata: (payload.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
    include: notificationInclude(),
  })

  if (payload.priority === "URGENT" || payload.priority === "HIGH") {
    await createActivity({
      organizationId: input.organizationId,
      userId: null,
      type: "NOTIFICATION_CREATED",
      title: "Notification créée",
      description: payload.title,
      clientId: payload.clientId ?? null,
      leadId: payload.leadId ?? null,
      taskId: payload.taskId ?? null,
      documentId: payload.documentId ?? null,
      productId: payload.productId ?? null,
      alertId: payload.alertId ?? null,
      entityType: "Notification",
      entityId: notification.id,
      source: "SYSTEM",
    })
  }

  return notification
}

export async function createNotificationForUser(input: CreateNotificationInput & { organizationId: string; userId: string }) {
  return createNotification(input)
}

export async function createNotificationForRole(input: Omit<CreateNotificationInput, "userId"> & { organizationId: string; role: UserRole }) {
  const users = await prisma.user.findMany({
    where: { organizationId: input.organizationId, role: input.role },
    select: { id: true },
  })

  return Promise.all(users.map((user) => createNotification({ ...input, userId: user.id })))
}

export async function getNotifications({ organizationId, user, query }: { organizationId: string; user: CurrentUser; query: unknown }) {
  const parsed = notificationQuerySchema.parse(query)
  const where: Prisma.NotificationWhereInput = {
    ...notificationAccessWhere(organizationId, user),
  }

  if (parsed.status) where.status = parsed.status
  if (parsed.priority) where.priority = parsed.priority
  if (parsed.type) where.type = parsed.type
  if (typeof parsed.isRead === "boolean") where.isRead = parsed.isRead
  if (parsed.userId && user.role === "OWNER") where.userId = parsed.userId
  if (parsed.dateFrom || parsed.dateTo) {
    where.createdAt = { gte: parsed.dateFrom, lte: parsed.dateTo }
  }
  if (parsed.search) {
    where.OR = [
      { title: { contains: parsed.search, mode: "insensitive" } },
      { message: { contains: parsed.search, mode: "insensitive" } },
    ]
  }

  const skip = (parsed.page - 1) * parsed.limit
  const [items, total] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      include: notificationInclude(),
      orderBy: [{ status: "desc" }, { createdAt: "desc" }],
      skip,
      take: parsed.limit,
    }),
    prisma.notification.count({ where }),
  ])

  return {
    items,
    total,
    page: parsed.page,
    limit: parsed.limit,
    totalPages: Math.max(1, Math.ceil(total / parsed.limit)),
  }
}

export async function getUnreadCount({ organizationId, user }: { organizationId: string; user: CurrentUser }) {
  return prisma.notification.count({
    where: {
      ...notificationAccessWhere(organizationId, user),
      status: "UNREAD",
      isRead: false,
    },
  })
}

async function getAccessibleNotification(organizationId: string, user: CurrentUser, id: string) {
  const notification = await prisma.notification.findFirst({
    where: {
      id,
      ...notificationAccessWhere(organizationId, user),
    },
  })
  if (!notification) throw new Error("NOTIFICATION_NOT_FOUND")
  return notification
}

export async function markNotificationRead({ organizationId, user, id }: { organizationId: string; user: CurrentUser; id: string }) {
  const notification = await getAccessibleNotification(organizationId, user, id)
  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { status: "READ", isRead: true, readAt: notification.readAt ?? new Date() },
    include: notificationInclude(),
  })
  await createActivity({ organizationId, userId: user.id, type: "NOTIFICATION_READ", title: "Notification lue", description: updated.title, entityType: "Notification", entityId: updated.id, source: "USER" })
  return updated
}

export async function markAllNotificationsRead({ organizationId, user }: { organizationId: string; user: CurrentUser }) {
  const result = await prisma.notification.updateMany({
    where: { ...notificationAccessWhere(organizationId, user), status: "UNREAD" },
    data: { status: "READ", isRead: true, readAt: new Date() },
  })
  return result
}

export async function dismissNotification({ organizationId, user, id, reason }: { organizationId: string; user: CurrentUser; id: string; reason?: string }) {
  const notification = await getAccessibleNotification(organizationId, user, id)
  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: "DISMISSED",
      isRead: true,
      readAt: notification.readAt ?? new Date(),
      dismissedAt: new Date(),
      metadata: reason ? ({ dismissReason: reason } as Prisma.InputJsonValue) : notification.metadata ?? Prisma.JsonNull,
    },
    include: notificationInclude(),
  })
  await createActivity({ organizationId, userId: user.id, type: "NOTIFICATION_DISMISSED", title: "Notification ignorée", description: updated.title, entityType: "Notification", entityId: updated.id, source: "USER", metadata: reason ? { reason } : undefined })
  return updated
}

export async function archiveNotification({ organizationId, user, id }: { organizationId: string; user: CurrentUser; id: string }) {
  const notification = await getAccessibleNotification(organizationId, user, id)
  return prisma.notification.update({
    where: { id: notification.id },
    data: { status: "ARCHIVED", isRead: true, archivedAt: new Date(), readAt: notification.readAt ?? new Date() },
    include: notificationInclude(),
  })
}

export async function deleteNotification({ organizationId, user, id }: { organizationId: string; user: CurrentUser; id: string }) {
  const notification = await getAccessibleNotification(organizationId, user, id)
  return prisma.notification.delete({
    where: { id: notification.id },
    include: notificationInclude(),
  })
}

export function normalizeNotificationType(type?: NotificationType | string | null): NotificationType {
  if (type === "ALERT") return "SMART_ALERT_CREATED"
  if (type === "WARNING") return "SYSTEM"
  if (type === "SUCCESS") return "SYSTEM"
  if (type === "INFO") return "SYSTEM"
  return (type as NotificationType) ?? "SYSTEM"
}

export function priorityFromLegacyType(type?: NotificationType | string | null): NotificationPriority {
  if (type === "ALERT") return "HIGH"
  if (type === "WARNING") return "NORMAL"
  return "NORMAL"
}
