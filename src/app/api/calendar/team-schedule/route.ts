import { handleApiError, ok } from "@/lib/api-response"
import { getExternalCalendarBusyRanges } from "@/lib/calendar/external"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

function dayBounds(value: string | null) {
  const date = value ? new Date(`${value}T00:00:00`) : new Date()
  if (Number.isNaN(date.getTime())) date.setTime(Date.now())
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const { start, end } = dayBounds(searchParams.get("date"))
    const timezone = searchParams.get("timezone") ?? "America/Toronto"
    const advisors = await prisma.user.findMany({
      where: { organizationId, role: { in: ["OWNER", "ADVISOR", "ASSISTANT"] } },
      select: {
        id: true,
        name: true,
        email: true,
        title: true,
        advisorProfile: { select: { publicName: true, publicSlug: true } },
      },
      orderBy: [{ routingPriority: "desc" }, { name: "asc" }],
    })
    const rows = await Promise.all(advisors.map(async (advisor) => {
      const [events, bookings, holds, externalBusy] = await Promise.all([
        prisma.calendarEvent.findMany({
          where: { organizationId, advisorId: advisor.id, status: { notIn: ["CANCELLED", "ARCHIVED"] }, startAt: { lt: end }, endAt: { gt: start } },
          select: { id: true, title: true, startAt: true, endAt: true, source: true },
        }),
        prisma.booking.findMany({
          where: { organizationId, advisorId: advisor.id, status: { notIn: ["CANCELLED", "ARCHIVED"] }, startAt: { lt: end }, endAt: { gt: start } },
          select: { id: true, clientName: true, startAt: true, endAt: true },
        }),
        prisma.bookingHold.findMany({
          where: { organizationId, advisorId: advisor.id, status: "ACTIVE", expiresAt: { gt: new Date() }, startAt: { lt: end }, endAt: { gt: start } },
          select: { id: true, startAt: true, endAt: true },
        }),
        getExternalCalendarBusyRanges({ organizationId, advisorId: advisor.id, start, end, timezone }).catch(() => []),
      ])
      return {
        advisor: {
          id: advisor.id,
          name: advisor.advisorProfile?.publicName || advisor.name,
          email: advisor.email,
          title: advisor.title,
          publicSlug: advisor.advisorProfile?.publicSlug,
        },
        busy: [
          ...events.map((event) => ({ id: event.id, title: event.title, start: event.startAt.toISOString(), end: event.endAt.toISOString(), source: event.source || "INTERNAL" })),
          ...bookings.map((booking) => ({ id: booking.id, title: `Réservation - ${booking.clientName}`, start: booking.startAt.toISOString(), end: booking.endAt.toISOString(), source: "PUBLIC_BOOKING" })),
          ...holds.map((hold) => ({ id: hold.id, title: "Créneau temporairement bloqué", start: hold.startAt.toISOString(), end: hold.endAt.toISOString(), source: "HOLD" })),
          ...externalBusy.map((range, index) => ({ id: `${advisor.id}-external-${index}`, title: range.source === "GOOGLE_CALENDAR" ? "Occupé Google" : "Occupé Outlook", start: range.start.toISOString(), end: range.end.toISOString(), source: range.source })),
        ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
      }
    }))
    return ok({ date: start.toISOString(), rows })
  } catch (error) {
    return handleApiError(error)
  }
}

