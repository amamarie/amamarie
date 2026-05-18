import { Prisma, type CrossSellPriority } from "@prisma/client"

import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"

function dueDateForPriority(priority: CrossSellPriority) {
  const date = new Date()
  const days = priority === "CRITICAL" ? 0 : priority === "HIGH" ? 3 : priority === "MEDIUM" ? 7 : 14
  date.setDate(date.getDate() + days)
  return date
}

function taskPriority(priority: CrossSellPriority) {
  if (priority === "CRITICAL") return "URGENT"
  if (priority === "HIGH") return "HIGH"
  if (priority === "MEDIUM") return "NORMAL"
  return "LOW"
}

async function getOpportunity(id: string, organizationId: string) {
  return prisma.crossSellOpportunity.findFirst({
    where: { id, organizationId },
    include: { client: true, relatedProduct: true },
  })
}

async function updateStatus({
  id,
  organizationId,
  userId,
  status,
  activityType,
  title,
  data,
}: {
  id: string
  organizationId: string
  userId?: string | null
  status: "REVIEWED" | "DISMISSED" | "DISCUSSED" | "WON" | "LOST"
  activityType:
    | "CROSS_SELL_REVIEWED"
    | "CROSS_SELL_DISMISSED"
    | "CROSS_SELL_DISCUSSSED"
    | "CROSS_SELL_DISCUSSED"
    | "CROSS_SELL_WON"
    | "CROSS_SELL_LOST"
  title: string
  data?: Record<string, unknown>
}) {
  const opportunity = await getOpportunity(id, organizationId)
  if (!opportunity) throw new Error("Opportunité introuvable.")

  const now = new Date()
  const currentMetadata =
    opportunity.metadata && typeof opportunity.metadata === "object" && !Array.isArray(opportunity.metadata)
      ? opportunity.metadata
      : {}
  const updated = await prisma.crossSellOpportunity.update({
    where: { id },
    data: {
      status,
      ...(status === "REVIEWED" ? { reviewedAt: now } : {}),
      ...(status === "DISMISSED" ? { dismissedAt: now } : {}),
      ...(status === "DISCUSSED" ? { discussedAt: now } : {}),
      ...(status === "WON" ? { wonAt: now } : {}),
      ...(status === "LOST" ? { lostAt: now } : {}),
      ...(data ? { metadata: { ...currentMetadata, ...data } as Prisma.InputJsonValue } : {}),
    },
  })

  await createCrmActivity({
    organizationId,
    userId,
    clientId: opportunity.clientId,
    type: activityType,
    title,
    description: opportunity.title,
  })

  return updated
}

export function markCrossSellReviewed(input: { id: string; organizationId: string; userId?: string | null }) {
  return updateStatus({
    ...input,
    status: "REVIEWED",
    activityType: "CROSS_SELL_REVIEWED",
    title: "Opportunité consultée",
  })
}

export function dismissCrossSell(input: { id: string; organizationId: string; userId?: string | null; reason?: string }) {
  return updateStatus({
    ...input,
    status: "DISMISSED",
    activityType: "CROSS_SELL_DISMISSED",
    title: "Opportunité ignorée",
    data: { dismissalReason: input.reason },
  })
}

export function discussCrossSell(input: { id: string; organizationId: string; userId?: string | null; note?: string; discussedAt?: Date }) {
  return updateStatus({
    ...input,
    status: "DISCUSSED",
    activityType: "CROSS_SELL_DISCUSSSED",
    title: "Opportunité discutée",
    data: { discussionNote: input.note, discussedAt: input.discussedAt?.toISOString() },
  })
}

export function winCrossSell(input: { id: string; organizationId: string; userId?: string | null; productId?: string; note?: string }) {
  return updateStatus({
    ...input,
    status: "WON",
    activityType: "CROSS_SELL_WON",
    title: "Opportunité gagnée",
    data: { productId: input.productId, note: input.note },
  })
}

export function loseCrossSell(input: { id: string; organizationId: string; userId?: string | null; reason: string; note?: string }) {
  return updateStatus({
    ...input,
    status: "LOST",
    activityType: "CROSS_SELL_LOST",
    title: "Opportunité perdue",
    data: { lostReason: input.reason, note: input.note },
  })
}

export async function convertCrossSellToTask({
  id,
  organizationId,
  userId,
  assignedToId,
  dueDate,
  title,
}: {
  id: string
  organizationId: string
  userId?: string | null
  assignedToId?: string
  dueDate?: Date
  title?: string
}) {
  const opportunity = await getOpportunity(id, organizationId)
  if (!opportunity) throw new Error("Opportunité introuvable.")

  if (assignedToId) {
    const user = await prisma.user.findFirst({ where: { id: assignedToId, organizationId }, select: { id: true } })
    if (!user) throw new Error("Conseiller assigné introuvable.")
  }

  const task = await prisma.task.create({
    data: {
      organizationId,
      clientId: opportunity.clientId,
      assignedToId: assignedToId ?? opportunity.advisorId ?? userId ?? undefined,
      title: title ?? opportunity.actionLabel ?? opportunity.title,
      description: [
        opportunity.description,
        opportunity.rationale,
        "Opportunité interne seulement: le sujet doit être validé par le conseiller avant toute recommandation.",
      ]
        .filter(Boolean)
        .join("\n\n"),
      priority: taskPriority(opportunity.priority),
      dueDate: dueDate ?? dueDateForPriority(opportunity.priority),
    },
  })

  const updated = await prisma.crossSellOpportunity.update({
    where: { id },
    data: { status: "CONVERTED_TO_TASK", relatedTaskId: task.id },
  })

  await createCrmActivity({
    organizationId,
    userId,
    clientId: opportunity.clientId,
    type: "CROSS_SELL_CONVERTED_TO_TASK",
    title: "Opportunité convertie en tâche",
    description: task.title,
  })

  await prisma.notification.create({
    data: {
      organizationId,
      userId: task.assignedToId,
      type: "INFO",
      title: "Tâche créée depuis une opportunité",
      message: task.title,
      href: `/clients/${opportunity.clientId}`,
    },
  })

  return { opportunity: updated, task }
}
