import type { PriorityLevel } from "@prisma/client"

import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"

async function getPriorityItem(organizationId: string, id: string) {
  const item = await prisma.priorityItem.findFirst({ where: { id, organizationId } })
  if (!item) throw new Error("PRIORITY_NOT_FOUND")
  return item
}

export async function snoozePriorityItem({
  organizationId,
  userId,
  id,
  snoozedUntil,
}: {
  organizationId: string
  userId: string
  id: string
  snoozedUntil: Date
}) {
  const item = await getPriorityItem(organizationId, id)
  await prisma.priorityItem.updateMany({
    where: { id, organizationId },
    data: { status: "SNOOZED", snoozedUntil },
  })
  const updated = await prisma.priorityItem.findFirstOrThrow({ where: { id, organizationId } })
  await createAuditLog({ organizationId, userId, clientId: item.clientId, entityType: "PRIORITY_ITEM", entityId: id, action: "PRIORITY_SNOOZED", newValue: { snoozedUntil: snoozedUntil.toISOString() } })
  return updated
}

export async function dismissPriorityItem({
  organizationId,
  userId,
  id,
  dismissedReason,
}: {
  organizationId: string
  userId: string
  id: string
  dismissedReason: string
}) {
  const item = await getPriorityItem(organizationId, id)
  await prisma.priorityItem.updateMany({
    where: { id, organizationId },
    data: { status: "DISMISSED", dismissedAt: new Date(), dismissedReason },
  })
  const updated = await prisma.priorityItem.findFirstOrThrow({ where: { id, organizationId } })
  await createAuditLog({ organizationId, userId, clientId: item.clientId, entityType: "PRIORITY_ITEM", entityId: id, action: "PRIORITY_DISMISSED", newValue: { dismissedReason } })
  return updated
}

export async function completePriorityItem({ organizationId, userId, id }: { organizationId: string; userId: string; id: string }) {
  const item = await getPriorityItem(organizationId, id)
  await prisma.priorityItem.updateMany({
    where: { id, organizationId },
    data: { status: "COMPLETED", completedAt: new Date() },
  })
  const updated = await prisma.priorityItem.findFirstOrThrow({ where: { id, organizationId } })
  await createAuditLog({ organizationId, userId, clientId: item.clientId, entityType: "PRIORITY_ITEM", entityId: id, action: "PRIORITY_COMPLETED" })
  return updated
}

export async function assignPriorityItem({
  organizationId,
  userId,
  id,
  advisorId,
}: {
  organizationId: string
  userId: string
  id: string
  advisorId: string
}) {
  const item = await getPriorityItem(organizationId, id)
  const advisor = await prisma.user.findFirst({ where: { id: advisorId, organizationId }, select: { id: true } })
  if (!advisor) throw new Error("ADVISOR_NOT_FOUND")
  await prisma.priorityItem.updateMany({ where: { id, organizationId }, data: { advisorId } })
  const updated = await prisma.priorityItem.findFirstOrThrow({ where: { id, organizationId } })
  await createAuditLog({ organizationId, userId, clientId: item.clientId, entityType: "PRIORITY_ITEM", entityId: id, action: "PRIORITY_ASSIGNED", newValue: { advisorId } })
  return updated
}

export async function overridePriorityItem({
  organizationId,
  userId,
  id,
  level,
  reason,
}: {
  organizationId: string
  userId: string
  id: string
  level: PriorityLevel
  reason: string
}) {
  const item = await getPriorityItem(organizationId, id)
  await prisma.priorityItem.updateMany({ where: { id, organizationId }, data: { level, reason: `${item.reason ?? ""}\nPriorité ajustée manuellement: ${reason}`.trim() } })
  const updated = await prisma.priorityItem.findFirstOrThrow({ where: { id, organizationId } })
  await createAuditLog({ organizationId, userId, clientId: item.clientId, entityType: "PRIORITY_ITEM", entityId: id, action: "PRIORITY_OVERRIDDEN", oldValue: { level: item.level }, newValue: { level, reason } })
  return updated
}
