import type { Prisma } from "@prisma/client"

import { handleApiError, ok } from "@/lib/api-response"
import { createTask, getTasks } from "@/lib/services/tasks"
import { getTenantContext } from "@/lib/tenant"
import { createTaskSchema, taskQuerySchema } from "@/lib/validations/task"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const query = taskQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()))
    const where: Prisma.TaskWhereInput = {}

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ]
    }
    if (query.status) where.status = query.status
    if (query.priority) where.priority = query.priority
    if (query.type) where.type = query.type
    if (query.assignedToId) where.assignedToId = query.assignedToId
    if (query.clientId) where.clientId = query.clientId
    if (query.leadId) where.leadId = query.leadId
    if (query.dueDateFrom || query.dueDateTo) where.dueDate = { gte: query.dueDateFrom, lte: query.dueDateTo }
    if (query.view === "today") {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      const end = new Date()
      end.setHours(23, 59, 59, 999)
      where.OR = [{ dueDate: { gte: start, lte: end } }, { priority: "URGENT" }]
      where.status = { in: ["TODO", "IN_PROGRESS", "WAITING", "OVERDUE", "SNOOZED"] }
    }
    if (query.view === "overdue") {
      where.dueDate = { lt: new Date() }
      where.status = { in: ["TODO", "IN_PROGRESS", "WAITING"] }
    }
    if (query.view === "upcoming") where.dueDate = { gt: new Date() }
    if (query.view === "automated") where.isAutomated = true
    if (query.view === "done") where.status = "DONE"
    if (query.view === "snoozed") where.status = "SNOOZED"
    if (!query.status && !where.status) where.status = { not: "ARCHIVED" }

    const tasks = await getTasks({
      organizationId,
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    })

    return ok(tasks)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const data = createTaskSchema.parse(await request.json())
    return ok(await createTask({ organizationId, userId, data }), { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
