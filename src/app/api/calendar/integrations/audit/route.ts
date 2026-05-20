import { handleApiError, ok } from "@/lib/api-response"
import { getExternalCalendarBusyRanges } from "@/lib/calendar/external"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId, userId } = await getTenantContext()
    const start = new Date()
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
    const [connections, busy] = await Promise.all([
      prisma.externalCalendarConnection.findMany({
        where: { organizationId, userId },
        select: { provider: true, providerAccountEmail: true, syncEnabled: true, status: true, lastSyncAt: true },
        orderBy: { provider: "asc" },
      }),
      getExternalCalendarBusyRanges({ organizationId, advisorId: userId, start, end, timezone: "America/Toronto" }),
    ])
    return ok({
      window: { start: start.toISOString(), end: end.toISOString() },
      connections,
      busyRanges: busy.map((range) => ({ source: range.source, start: range.start.toISOString(), end: range.end.toISOString() })),
      status: connections.some((connection) => connection.status === "CONNECTED" && connection.syncEnabled) ? "CONNECTED" : "NOT_CONNECTED",
    })
  } catch (error) {
    return handleApiError(error)
  }
}

