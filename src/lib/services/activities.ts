import { Prisma, type ActivityType } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import { activityQuerySchema, createActivitySchema, type ActivityQueryInput, type CreateActivityInput } from "@/lib/validations/activity"

function normalizeEntity(input: CreateActivityInput) {
  if (input.entityType && input.entityId) {
    return { entityType: input.entityType, entityId: input.entityId }
  }

  if (input.clientId) return { entityType: "Client", entityId: input.clientId }
  if (input.leadId) return { entityType: "Lead", entityId: input.leadId }
  if (input.taskId) return { entityType: "Task", entityId: input.taskId }
  if (input.documentId) return { entityType: "Document", entityId: input.documentId }
  if (input.productId) return { entityType: "FinancialProduct", entityId: input.productId }
  if (input.noteId) return { entityType: "Note", entityId: input.noteId }
  if (input.alertId) return { entityType: "ComplianceAlert", entityId: input.alertId }
  if (input.automationRuleId) return { entityType: "AutomationRule", entityId: input.automationRuleId }

  return { entityType: null, entityId: null }
}

export async function createActivity(input: CreateActivityInput & { organizationId: string }) {
  try {
    const payload = createActivitySchema.parse(input)
    const entity = normalizeEntity(payload)

    return await prisma.activity.create({
      data: {
        organizationId: input.organizationId,
        userId: payload.userId ?? null,
        clientId: payload.clientId ?? null,
        leadId: payload.leadId ?? null,
        taskId: payload.taskId ?? null,
        documentId: payload.documentId ?? null,
        productId: payload.productId ?? null,
        noteId: payload.noteId ?? null,
        alertId: payload.alertId ?? null,
        automationRuleId: payload.automationRuleId ?? null,
        type: payload.type as ActivityType,
        title: payload.title,
        description: payload.description ?? null,
        entityType: entity.entityType,
        entityId: entity.entityId,
        source: payload.source,
        metadata: (payload.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    console.warn({
      action: "activity_create_failed",
      name: error instanceof Error ? error.name : "UnknownError",
    })
    return null
  }
}

export function buildActivityWhere(organizationId: string, query: ActivityQueryInput) {
  const where: Prisma.ActivityWhereInput = { organizationId }

  if (query.clientId) where.clientId = query.clientId
  if (query.leadId) where.leadId = query.leadId
  if (query.taskId) where.taskId = query.taskId
  if (query.documentId) where.documentId = query.documentId
  if (query.productId) where.productId = query.productId
  if (query.type) where.type = query.type
  if (query.source) where.source = query.source
  if (query.userId) where.userId = query.userId
  if (query.entityType) where.entityType = query.entityType
  if (query.entityId) where.entityId = query.entityId
  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      gte: query.dateFrom,
      lte: query.dateTo,
    }
  }
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ]
  }

  return where
}

export async function getActivities({
  organizationId,
  query,
}: {
  organizationId: string
  query: unknown
}) {
  const parsed = activityQuerySchema.parse(query)
  const where = buildActivityWhere(organizationId, parsed)
  const skip = (parsed.page - 1) * parsed.limit

  const [items, total] = await prisma.$transaction([
    prisma.activity.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        client: { select: { id: true, firstName: true, lastName: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: parsed.limit,
    }),
    prisma.activity.count({ where }),
  ])

  return {
    items,
    total,
    page: parsed.page,
    limit: parsed.limit,
    totalPages: Math.max(1, Math.ceil(total / parsed.limit)),
  }
}

export async function getClientActivities(organizationId: string, clientId: string, query: unknown) {
  return getActivities({ organizationId, query: { ...(query as object), clientId } })
}

export async function getLeadActivities(organizationId: string, leadId: string, query: unknown) {
  return getActivities({ organizationId, query: { ...(query as object), leadId } })
}

export async function getEntityActivities(organizationId: string, entityType: string, entityId: string, query: unknown) {
  return getActivities({ organizationId, query: { ...(query as object), entityType, entityId } })
}
