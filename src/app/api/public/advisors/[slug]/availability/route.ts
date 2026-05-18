import { fail, handleApiError, ok } from "@/lib/api-response"
import { getExternalCalendarBusyRanges } from "@/lib/calendar/external"
import { defaultMeetingTypes } from "@/lib/calendar/types"
import { prisma } from "@/lib/prisma"

function setTime(date: Date, minutes: number) {
  const next = new Date(date)
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return next
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const url = new URL(request.url)
    const dateParam = url.searchParams.get("date")
    const meetingTypeId = url.searchParams.get("meetingTypeId")
    const timezone = url.searchParams.get("timezone") || "UTC"
    const day = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date()
    if (Number.isNaN(day.getTime())) return fail("INVALID_DATE", "Date invalide.", 422)

    const advisors = await prisma.user.findMany({
      where: { role: { in: ["OWNER", "ADVISOR", "ASSISTANT"] } },
      select: { id: true, name: true, email: true, organizationId: true },
      take: 500,
    })
    const advisor = advisors.find((item) => item.id === slug || slugify(item.name ?? item.email) === slug || slugify(item.email.split("@")[0]) === slug)
    if (!advisor) return fail("NOT_FOUND", "Conseiller introuvable.", 404)

    const meetingType = meetingTypeId ? await prisma.meetingType.findFirst({
      where: { id: meetingTypeId, organizationId: advisor.organizationId, isPublic: true, OR: [{ advisorId: advisor.id }, { advisorId: null }] },
    }) : null
    const fallback = defaultMeetingTypes[0]
    const durationMinutes = meetingType?.durationMinutes ?? fallback.durationMinutes
    const slotStepMinutes = meetingType?.slotStepMinutes ?? fallback.slotStepMinutes
    const bufferBeforeMinutes = meetingType?.bufferBeforeMinutes ?? fallback.bufferBeforeMinutes
    const bufferAfterMinutes = meetingType?.bufferAfterMinutes ?? fallback.bufferAfterMinutes
    const minimumNoticeHours = meetingType?.minimumNoticeHours ?? fallback.minimumNoticeHours
    const maxBookingsPerDay = meetingType?.maxBookingsPerDay ?? fallback.maxBookingsPerDay

    const startOfDay = new Date(day)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(day)
    endOfDay.setHours(23, 59, 59, 999)

    const [slots, events, bookings, holds, exceptions, externalBusy] = await Promise.all([
      prisma.advisorAvailabilitySlot.findMany({
        where: { organizationId: advisor.organizationId, advisorId: advisor.id, dayOfWeek: day.getDay(), isActive: true },
        orderBy: { startMinutes: "asc" },
      }),
      prisma.calendarEvent.findMany({
        where: {
          organizationId: advisor.organizationId,
          advisorId: advisor.id,
          status: { notIn: ["CANCELLED", "ARCHIVED"] },
          startAt: { lt: endOfDay },
          endAt: { gt: startOfDay },
        },
        select: { startAt: true, endAt: true },
      }),
      prisma.booking.findMany({
        where: {
          organizationId: advisor.organizationId,
          advisorId: advisor.id,
          status: { notIn: ["CANCELLED", "ARCHIVED"] },
          startAt: { lt: endOfDay },
          endAt: { gt: startOfDay },
        },
        select: { startAt: true, endAt: true },
      }),
      prisma.bookingHold.findMany({
        where: {
          organizationId: advisor.organizationId,
          advisorId: advisor.id,
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
          startAt: { lt: endOfDay },
          endAt: { gt: startOfDay },
        },
        select: { startAt: true, endAt: true },
      }),
      prisma.availabilityException.findMany({
        where: { organizationId: advisor.organizationId, advisorId: advisor.id, date: { gte: startOfDay, lte: endOfDay } },
      }),
      getExternalCalendarBusyRanges({ organizationId: advisor.organizationId, advisorId: advisor.id, start: startOfDay, end: endOfDay, timezone }),
    ])

    const busyRanges = [
      ...events,
      ...bookings,
      ...holds,
      ...exceptions.map((exception) => ({
        startAt: setTime(day, exception.startMinutes ?? 0),
        endAt: setTime(day, exception.endMinutes ?? 24 * 60),
      })),
      ...externalBusy.map((range) => ({ startAt: range.start, endAt: range.end })),
    ].map((range) => ({
      start: new Date(range.startAt.getTime() - bufferBeforeMinutes * 60_000),
      end: new Date(range.endAt.getTime() + bufferAfterMinutes * 60_000),
    }))

    const currentBookings = bookings.length
    const slotsAvailable = currentBookings >= maxBookingsPerDay ? [] : slots.flatMap((slot) => {
      const candidates: Array<{ start: string; end: string }> = []
      for (let minutes = slot.startMinutes; minutes + durationMinutes <= slot.endMinutes; minutes += slotStepMinutes) {
        const start = setTime(day, minutes)
        const end = new Date(start.getTime() + durationMinutes * 60_000)
        if (start.getTime() <= Date.now() + minimumNoticeHours * 60 * 60 * 1000) continue
        if (busyRanges.some((range) => overlaps(start, end, range.start, range.end))) continue
        candidates.push({ start: start.toISOString(), end: end.toISOString() })
      }
      return candidates
    })

    return ok({ date: dateParam ?? startOfDay.toISOString().slice(0, 10), timezone, slots: slotsAvailable })
  } catch (error) {
    return handleApiError(error)
  }
}
