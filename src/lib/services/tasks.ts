import type { Prisma, Priority, TaskStatus } from "@prisma/client"

import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/services/notifications"
import { closeSmartRemindersForCompletedTask } from "@/lib/smart-reminders/service"
import type { createTaskSchema, updateTaskSchema } from "@/lib/validations/task"
import type { z } from "zod"

type TaskCreateInput = z.infer<typeof createTaskSchema>
type TaskUpdateInput = z.infer<typeof updateTaskSchema>

const taskInclude = {
  assignedTo: true,
  createdBy: true,
  lead: true,
  client: true,
  product: true,
} satisfies Prisma.TaskInclude

export function calculateTaskStatus(task: { status: TaskStatus; dueDate?: Date | null; snoozedUntil?: Date | null }) {
  if (["DONE", "CANCELLED", "ARCHIVED"].includes(task.status)) return task.status
  if (task.status === "SNOOZED" && task.snoozedUntil && task.snoozedUntil > new Date()) return "SNOOZED"
  if (task.dueDate && task.dueDate < new Date() && ["TODO", "IN_PROGRESS", "WAITING", "SNOOZED"].includes(task.status)) return "OVERDUE"
  return task.status === "OVERDUE" && task.dueDate && task.dueDate >= new Date() ? "TODO" : task.status
}

async function assertRelatedOwnership(organizationId: string, data: Partial<TaskCreateInput>) {
  const checks: Promise<unknown>[] = []

  if (data.assignedToId) checks.push(prisma.user.findFirstOrThrow({ where: { id: data.assignedToId, organizationId }, select: { id: true } }))
  if (data.leadId) checks.push(prisma.lead.findFirstOrThrow({ where: { id: data.leadId, organizationId }, select: { id: true } }))
  if (data.clientId) checks.push(prisma.client.findFirstOrThrow({ where: { id: data.clientId, organizationId }, select: { id: true } }))
  if (data.productId) checks.push(prisma.financialProduct.findFirstOrThrow({ where: { id: data.productId, organizationId }, select: { id: true } }))
  if (data.alertId) checks.push(prisma.complianceAlert.findFirstOrThrow({ where: { id: data.alertId, organizationId }, select: { id: true } }))
  if (data.recommendationId) checks.push(prisma.productRecommendation.findFirstOrThrow({ where: { id: data.recommendationId, organizationId }, select: { id: true } }))
  if (data.crossSellOpportunityId) checks.push(prisma.crossSellOpportunity.findFirstOrThrow({ where: { id: data.crossSellOpportunityId, organizationId }, select: { id: true } }))

  await Promise.all(checks)
}

async function getOwnedTask(organizationId: string, id: string) {
  const task = await prisma.task.findFirst({ where: { id, organizationId } })
  if (!task) throw new Error("TASK_NOT_FOUND")
  return task
}

async function notifyAssignedUser(task: { organizationId: string; assignedToId: string | null; title: string; priority: Priority; id: string }, currentUserId: string) {
  if (!task.assignedToId || task.assignedToId === currentUserId) return
  await createNotification({
    organizationId: task.organizationId,
    userId: task.assignedToId,
    type: "TASK_ASSIGNED",
    priority: task.priority === "URGENT" ? "URGENT" : task.priority === "HIGH" ? "HIGH" : "NORMAL",
    title: task.priority === "URGENT" ? "Nouvelle tâche urgente" : "Nouvelle tâche assignée",
    message: task.title,
    actionLabel: "Ouvrir tâche",
    actionUrl: "/taches",
    entityType: "Task",
    entityId: task.id,
    taskId: task.id,
  })
}

export async function createTask({ organizationId, userId, data }: { organizationId: string; userId: string; data: TaskCreateInput }) {
  await assertRelatedOwnership(organizationId, data)
  const task = await prisma.task.create({
    data: {
      ...data,
      organizationId,
      createdById: userId,
      assignedToId: data.assignedToId ?? userId,
    },
    include: taskInclude,
  })

  await createCrmActivity({ organizationId, userId, leadId: task.leadId, clientId: task.clientId, taskId: task.id, type: "TASK_CREATED", title: "Tâche créée", description: task.title, entityType: "Task", entityId: task.id })
  await notifyAssignedUser(task, userId)
  await runAutomationsForEvent({ organizationId, userId, leadId: task.leadId, clientId: task.clientId, event: "TASK_CREATED", title: "Tâche créée", description: task.title })
  return task
}

export async function updateTask({ organizationId, userId, id, data }: { organizationId: string; userId: string; id: string; data: TaskUpdateInput }) {
  const existing = await getOwnedTask(organizationId, id)
  await assertRelatedOwnership(organizationId, data)
  const nextStatus = data.status ?? calculateTaskStatus({ status: existing.status, dueDate: data.dueDate ?? existing.dueDate, snoozedUntil: data.snoozedUntil ?? existing.snoozedUntil })
  await prisma.task.updateMany({
    where: { id, organizationId },
    data: {
      ...data,
      status: nextStatus,
      completedAt: nextStatus === "DONE" && !existing.completedAt ? new Date() : data.completedAt,
      cancelledAt: nextStatus === "CANCELLED" && !existing.cancelledAt ? new Date() : data.cancelledAt,
    },
  })
  const task = await prisma.task.findFirstOrThrow({ where: { id, organizationId }, include: taskInclude })
  await createCrmActivity({ organizationId, userId, leadId: task.leadId, clientId: task.clientId, taskId: task.id, type: "TASK_UPDATED", title: "Tâche modifiée", description: task.title, entityType: "Task", entityId: task.id })
  if (existing.priority !== task.priority) await createCrmActivity({ organizationId, userId, leadId: task.leadId, clientId: task.clientId, taskId: task.id, type: "TASK_PRIORITY_CHANGED", title: "Priorité de tâche modifiée", description: task.title, entityType: "Task", entityId: task.id, metadata: { oldPriority: existing.priority, newPriority: task.priority } })
  return task
}

export async function completeTask({ organizationId, userId, id, outcome }: { organizationId: string; userId: string; id: string; outcome?: string }) {
  const existing = await getOwnedTask(organizationId, id)
  await prisma.task.updateMany({ where: { id, organizationId }, data: { status: "DONE", completedAt: new Date(), outcome } })
  const task = await prisma.task.findFirstOrThrow({ where: { id, organizationId }, include: taskInclude })
  await createCrmActivity({ organizationId, userId, leadId: task.leadId, clientId: task.clientId, taskId: task.id, type: "TASK_COMPLETED", title: "Tâche complétée", description: task.title, entityType: "Task", entityId: task.id })
  await runAutomationsForEvent({ organizationId, userId, leadId: task.leadId, clientId: task.clientId, event: "TASK_COMPLETED", title: "Tâche complétée", description: task.title })
  await closeSmartRemindersForCompletedTask({ organizationId, taskId: task.id, userId })
  if (existing.status === "DONE") return task
  return task
}

export async function cancelTask({ organizationId, userId, id, cancelReason }: { organizationId: string; userId: string; id: string; cancelReason: string }) {
  const existing = await getOwnedTask(organizationId, id)
  await prisma.task.updateMany({ where: { id, organizationId }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason } })
  const task = await prisma.task.findFirstOrThrow({ where: { id, organizationId }, include: taskInclude })
  await createCrmActivity({ organizationId, userId, leadId: existing.leadId, clientId: existing.clientId, taskId: task.id, type: "TASK_CANCELLED", title: "Tâche annulée", description: task.title, entityType: "Task", entityId: task.id, metadata: { reason: cancelReason } })
  return task
}

export async function snoozeTask({ organizationId, userId, id, snoozedUntil, snoozeReason }: { organizationId: string; userId: string; id: string; snoozedUntil: Date; snoozeReason?: string }) {
  const existing = await getOwnedTask(organizationId, id)
  await prisma.task.updateMany({ where: { id, organizationId }, data: { status: "SNOOZED", snoozedUntil, snoozeReason } })
  const task = await prisma.task.findFirstOrThrow({ where: { id, organizationId }, include: taskInclude })
  await createCrmActivity({ organizationId, userId, leadId: existing.leadId, clientId: existing.clientId, taskId: task.id, type: "TASK_SNOOZED", title: "Tâche reportée", description: task.title, entityType: "Task", entityId: task.id, metadata: { snoozedUntil, reason: snoozeReason } })
  return task
}

export async function reopenTask({ organizationId, userId, id }: { organizationId: string; userId: string; id: string }) {
  const existing = await getOwnedTask(organizationId, id)
  await prisma.task.updateMany({ where: { id, organizationId }, data: { status: "TODO", completedAt: null, cancelledAt: null, cancelReason: null, snoozedUntil: null, snoozeReason: null } })
  const task = await prisma.task.findFirstOrThrow({ where: { id, organizationId }, include: taskInclude })
  await createCrmActivity({ organizationId, userId, leadId: existing.leadId, clientId: existing.clientId, taskId: task.id, type: "TASK_REOPENED", title: "Tâche réouverte", description: task.title, entityType: "Task", entityId: task.id })
  return task
}

export async function assignTask({ organizationId, userId, id, assignedToId }: { organizationId: string; userId: string; id: string; assignedToId: string }) {
  const existing = await getOwnedTask(organizationId, id)
  await assertRelatedOwnership(organizationId, { assignedToId })
  await prisma.task.updateMany({ where: { id, organizationId }, data: { assignedToId } })
  const task = await prisma.task.findFirstOrThrow({ where: { id, organizationId }, include: taskInclude })
  await createCrmActivity({ organizationId, userId, leadId: existing.leadId, clientId: existing.clientId, taskId: task.id, type: "TASK_ASSIGNED", title: "Tâche assignée", description: task.title, entityType: "Task", entityId: task.id, metadata: { assignedToId } })
  await notifyAssignedUser(task, userId)
  return task
}

export async function getTasks({ organizationId, where, skip = 0, take = 50 }: { organizationId: string; where?: Prisma.TaskWhereInput; skip?: number; take?: number }) {
  await refreshOverdueTasks(organizationId)
  return prisma.task.findMany({
    where: { organizationId, ...where },
    include: taskInclude,
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    skip,
    take,
  })
}

export async function refreshOverdueTasks(organizationId: string) {
  await prisma.task.updateMany({
    where: { organizationId, status: { in: ["TODO", "IN_PROGRESS", "WAITING"] }, dueDate: { lt: new Date() } },
    data: { status: "OVERDUE" },
  })
}

export async function createFollowUpTask({ organizationId, userId, clientId, leadId, title, dueDate, priority = "NORMAL" }: { organizationId: string; userId: string; clientId?: string; leadId?: string; title: string; dueDate?: Date; priority?: Priority }) {
  return createTask({ organizationId, userId, data: { title, clientId, leadId, dueDate, priority, status: "TODO", type: "FOLLOW_UP", isAutomated: true } })
}
