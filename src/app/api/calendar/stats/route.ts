import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

function startOfDay(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const days = Math.min(180, Math.max(7, Number(searchParams.get("days") ?? 30)))
    const start = startOfDay(new Date())
    start.setDate(start.getDate() - days)
    const end = new Date()
    end.setDate(end.getDate() + 30)

    const [bookings, events, advisors] = await Promise.all([
      prisma.booking.findMany({
        where: { organizationId, startAt: { gte: start, lte: end } },
        select: { advisorId: true, meetingTypeId: true, status: true, startAt: true, createdAt: true },
      }),
      prisma.calendarEvent.count({
        where: { organizationId, startAt: { gte: start, lte: end }, status: { notIn: ["CANCELLED", "ARCHIVED"] } },
      }),
      prisma.user.findMany({ where: { organizationId }, select: { id: true, name: true } }),
    ])

    const confirmed = bookings.filter((booking) => booking.status === "CONFIRMED")
    const cancelled = bookings.filter((booking) => booking.status === "CANCELLED")
    const byAdvisor = advisors.map((advisor) => {
      const advisorBookings = confirmed.filter((booking) => booking.advisorId === advisor.id)
      return {
        advisorId: advisor.id,
        advisorName: advisor.name,
        confirmed: advisorBookings.length,
        cancelled: bookings.filter((booking) => booking.advisorId === advisor.id && booking.status === "CANCELLED").length,
      }
    }).sort((a, b) => b.confirmed - a.confirmed)

    const averageLeadTimeHours = confirmed.length
      ? Math.round(confirmed.reduce((sum, booking) => sum + Math.max(0, booking.startAt.getTime() - booking.createdAt.getTime()) / 3_600_000, 0) / confirmed.length)
      : 0

    return ok({
      range: { start: start.toISOString(), end: end.toISOString(), days },
      totals: {
        bookings: bookings.length,
        confirmed: confirmed.length,
        cancelled: cancelled.length,
        cancellationRate: bookings.length ? Math.round((cancelled.length / bookings.length) * 100) : 0,
        calendarEvents: events,
        averageLeadTimeHours,
      },
      byAdvisor,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

