import { endOfDay, startOfDay } from "@/lib/date-range"
import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { refreshOverdueTasks } from "@/lib/services/tasks"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId, userId } = await getTenantContext()
    await refreshOverdueTasks(organizationId)
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 7)
    const [todayCount, overdueCount, urgentCount, upcomingCount, assignedToMeCount, automatedCount, completedThisWeek, createdThisWeek] = await Promise.all([
      prisma.task.count({ where: { organizationId, status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] }, dueDate: { gte: startOfDay(now), lte: endOfDay(now) } } }),
      prisma.task.count({ where: { organizationId, status: "OVERDUE" } }),
      prisma.task.count({ where: { organizationId, status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] }, priority: "URGENT" } }),
      prisma.task.count({ where: { organizationId, status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] }, dueDate: { gt: endOfDay(now) } } }),
      prisma.task.count({ where: { organizationId, assignedToId: userId, status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] } } }),
      prisma.task.count({ where: { organizationId, isAutomated: true, status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] } } }),
      prisma.task.count({ where: { organizationId, status: "DONE", completedAt: { gte: weekStart } } }),
      prisma.task.count({ where: { organizationId, createdAt: { gte: weekStart } } }),
    ])
    return ok({ todayCount, overdueCount, urgentCount, upcomingCount, assignedToMeCount, automatedCount, completedThisWeek, completionRate: createdThisWeek ? Math.round((completedThisWeek / createdThisWeek) * 100) : 0 })
  } catch (error) {
    return handleApiError(error)
  }
}
