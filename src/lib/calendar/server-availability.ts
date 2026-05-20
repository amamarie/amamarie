import { getExternalCalendarBusyRanges } from "@/lib/calendar/external"
import { defaultMeetingTypes } from "@/lib/calendar/types"
import { getAvailableSlots } from "@/lib/calendar/availability"
import { prisma } from "@/lib/prisma"

type MeetingRules = {
  id: string
  durationMinutes: number
  slotStepMinutes: number
  bufferBeforeMinutes: number
  bufferAfterMinutes: number
  minimumNoticeHours: number
  maxBookingsPerDay: number
}

export type PublicAvailableSlot = {
  start: string
  end: string
}

function fallbackMeetingRules(): MeetingRules {
  const fallback = defaultMeetingTypes[0]
  return {
    id: fallback.id,
    durationMinutes: fallback.durationMinutes,
    slotStepMinutes: fallback.slotStepMinutes,
    bufferBeforeMinutes: fallback.bufferBeforeMinutes,
    bufferAfterMinutes: fallback.bufferAfterMinutes,
    minimumNoticeHours: fallback.minimumNoticeHours,
    maxBookingsPerDay: fallback.maxBookingsPerDay,
  }
}

export async function resolveMeetingRules({
  organizationId,
  advisorId,
  meetingTypeId,
}: {
  organizationId: string
  advisorId: string
  meetingTypeId?: string | null
}): Promise<MeetingRules> {
  const meetingType = meetingTypeId ? await prisma.meetingType.findFirst({
    where: { id: meetingTypeId, organizationId, isPublic: true, OR: [{ advisorId }, { advisorId: null }] },
    select: {
      id: true,
      durationMinutes: true,
      slotStepMinutes: true,
      bufferBeforeMinutes: true,
      bufferAfterMinutes: true,
      minimumNoticeHours: true,
      maxBookingsPerDay: true,
    },
  }) : null

  return meetingType ?? fallbackMeetingRules()
}

export async function getServerAvailableSlots({
  organizationId,
  advisorId,
  date,
  meetingTypeId,
  timezone = "UTC",
  excludeBookingId,
  excludeCalendarEventId,
}: {
  organizationId: string
  advisorId: string
  date: Date
  meetingTypeId?: string | null
  timezone?: string
  excludeBookingId?: string | null
  excludeCalendarEventId?: string | null
}): Promise<{ rules: MeetingRules; slots: PublicAvailableSlot[] }> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  await prisma.bookingHold.updateMany({
    where: { organizationId, advisorId, status: "ACTIVE", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  })

  const rules = await resolveMeetingRules({ organizationId, advisorId, meetingTypeId })
  const [availabilitySlots, events, tasks, bookings, holds, exceptions, externalBusy] = await Promise.all([
    prisma.advisorAvailabilitySlot.findMany({
      where: { organizationId, advisorId, dayOfWeek: date.getDay(), isActive: true },
      orderBy: { startMinutes: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: {
        organizationId,
        advisorId,
        id: excludeCalendarEventId ? { not: excludeCalendarEventId } : undefined,
        status: { notIn: ["CANCELLED", "ARCHIVED"] },
        startAt: { lt: endOfDay },
        endAt: { gt: startOfDay },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.task.findMany({
      where: {
        organizationId,
        assignedToId: advisorId,
        type: "MEETING",
        status: { notIn: ["CANCELLED", "ARCHIVED", "DONE"] },
        dueDate: { gte: startOfDay, lte: endOfDay },
      },
      select: { dueDate: true },
    }),
    prisma.booking.findMany({
      where: {
        organizationId,
        advisorId,
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        status: { notIn: ["CANCELLED", "ARCHIVED"] },
        startAt: { lt: endOfDay },
        endAt: { gt: startOfDay },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.bookingHold.findMany({
      where: {
        organizationId,
        advisorId,
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
        startAt: { lt: endOfDay },
        endAt: { gt: startOfDay },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.availabilityException.findMany({
      where: { organizationId, advisorId, date: { gte: startOfDay, lte: endOfDay } },
      select: { date: true, startMinutes: true, endMinutes: true, type: true },
    }),
    getExternalCalendarBusyRanges({ organizationId, advisorId, start: startOfDay, end: endOfDay, timezone }),
  ])

  const busyRanges = [
    ...events.map((event) => ({ start: event.startAt, end: event.endAt })),
    ...tasks.flatMap((task) => task.dueDate ? [{ start: task.dueDate, end: new Date(task.dueDate.getTime() + rules.durationMinutes * 60_000) }] : []),
    ...bookings.map((booking) => ({ start: booking.startAt, end: booking.endAt })),
    ...externalBusy.map((range) => ({ start: range.start, end: range.end })),
  ]

  const available = getAvailableSlots({
    date,
    availabilitySlots,
    busyRanges,
    holds: holds.map((hold) => ({ start: hold.startAt, end: hold.endAt })),
    exceptions,
    rules,
    bookingCount: bookings.length,
  })

  return {
    rules,
    slots: available.map((slot) => ({ start: slot.start.toISOString(), end: slot.end.toISOString() })),
  }
}
