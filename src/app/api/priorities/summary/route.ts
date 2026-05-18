import { startOfDay, endOfDay } from "@/lib/date-range"
import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    const now = new Date()
    const [totalActive, critical, high, dueToday, overdue, snoozed, byEntityType, byAdvisor, top] = await Promise.all([
      prisma.priorityItem.count({ where: { organizationId, status: "ACTIVE" } }),
      prisma.priorityItem.count({ where: { organizationId, status: "ACTIVE", level: "CRITICAL" } }),
      prisma.priorityItem.count({ where: { organizationId, status: "ACTIVE", level: "HIGH" } }),
      prisma.priorityItem.count({ where: { organizationId, status: "ACTIVE", dueAt: { gte: startOfDay(now), lte: endOfDay(now) } } }),
      prisma.priorityItem.count({ where: { organizationId, status: "ACTIVE", dueAt: { lt: startOfDay(now) } } }),
      prisma.priorityItem.count({ where: { organizationId, status: "SNOOZED" } }),
      prisma.priorityItem.groupBy({ by: ["entityType"], where: { organizationId, status: "ACTIVE" }, _count: true }),
      prisma.priorityItem.groupBy({ by: ["advisorId"], where: { organizationId, status: "ACTIVE" }, _count: true }),
      prisma.priorityItem.findMany({
        where: { organizationId, status: "ACTIVE" },
        orderBy: [{ score: "desc" }, { dueAt: "asc" }],
        take: 5,
      }),
    ])

    return ok({ totalActive, critical, high, dueToday, overdue, snoozed, byEntityType, byAdvisor, top })
  } catch (error) {
    return handleApiError(error)
  }
}
