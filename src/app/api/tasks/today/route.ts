import { endOfDay, startOfDay } from "@/lib/date-range"
import { handleApiError, ok } from "@/lib/api-response"
import { getTasks } from "@/lib/services/tasks"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    const now = new Date()
    return ok(await getTasks({ organizationId, where: { status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] }, OR: [{ dueDate: { gte: startOfDay(now), lte: endOfDay(now) } }, { priority: "URGENT" }] } }))
  } catch (error) {
    return handleApiError(error)
  }
}
