import { getExternalCalendarBusyRanges } from "@/lib/calendar/external"
import { ensureAdvisorProfile, resolvePublicAdvisor } from "@/lib/calendar/public-advisors"
import { defaultMeetingTypes } from "@/lib/calendar/types"
import { prisma } from "@/lib/prisma"

const defaultMeetingDurationMinutes = 60
const defaultMinimumNoticeHours = 24
const defaultSlotStepMinutes = 30
const defaultBufferAfterMinutes = 15

export type AvailabilitySlot = {
  id?: string
  dayOfWeek: number
  startMinutes: number
  endMinutes: number
  isActive: boolean
}

export type BookingService = {
  id: string
  label: string
  durationMinutes: number
  slotStepMinutes?: number
  bufferBeforeMinutes?: number
  bufferAfterMinutes?: number
  minimumNoticeHours?: number
  maxBookingsPerDay?: number | null
  locationType?: string | null
  description: string
  questionnaire?: Array<{ key: string; label: string; type: "text" | "textarea" | "select" | "checkbox"; options?: string[]; required?: boolean }> | null
}

export type PublicCalendarData = {
  advisor: {
    id: string
    name: string
    email: string
    title?: string | null
    phone?: string | null
    avatarUrl?: string | null
    publicSlug: string
    publicDescription?: string | null
    bookingEnabled: boolean
    timezone: string
    organization?: { name: string } | null
  }
  slots: AvailabilitySlot[]
  bookedStarts?: string[]
  bookedRanges?: Array<{ start: string; end: string; source?: string }>
  exceptions?: Array<{ date: string; startMinutes?: number | null; endMinutes?: number | null; type: string }>
  services: BookingService[]
}

type PublicQuestion = {
  key: string
  label: string
  type: "text" | "textarea" | "select" | "checkbox"
  options?: string[]
  required?: boolean
}

function normalizeQuestionnaire(value: unknown): PublicQuestion[] | null {
  if (!Array.isArray(value)) return null
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const question = item as Record<string, unknown>
    if (typeof question.key !== "string" || typeof question.label !== "string") return []
    const type = question.type === "select" || question.type === "textarea" || question.type === "checkbox" ? question.type : "text"
    const options = Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === "string") : undefined
    return [{ key: question.key, label: question.label, type, options, required: question.required === true }]
  })
}

export async function getPublicCalendarData(advisorId: string): Promise<PublicCalendarData | null> {
  const advisor = await resolvePublicAdvisor(advisorId)
  if (!advisor) return null
  const advisorProfile = await ensureAdvisorProfile(advisor)

  const slots = await prisma.advisorAvailabilitySlot.findMany({
    where: { advisorId, organizationId: advisor.organizationId, isActive: true },
    orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }],
  })
  const now = new Date()
  const horizon = new Date(now)
  horizon.setDate(horizon.getDate() + 60)
  const [bookedTasks, calendarEvents, bookings, holds, exceptions, meetingTypes, externalBusyRanges] = await Promise.all([
    prisma.task.findMany({
      where: {
        organizationId: advisor.organizationId,
        assignedToId: advisorId,
        type: "MEETING",
        status: { notIn: ["CANCELLED", "ARCHIVED", "DONE"] },
        dueDate: { gte: now, lte: horizon },
      },
      select: { dueDate: true },
    }),
    prisma.calendarEvent.findMany({
      where: {
        organizationId: advisor.organizationId,
        advisorId,
        status: { notIn: ["CANCELLED", "ARCHIVED"] },
        startAt: { gte: now, lte: horizon },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.booking.findMany({
      where: {
        organizationId: advisor.organizationId,
        advisorId,
        status: { notIn: ["CANCELLED", "ARCHIVED"] },
        startAt: { gte: now, lte: horizon },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.bookingHold.findMany({
      where: {
        organizationId: advisor.organizationId,
        advisorId,
        status: "ACTIVE",
        expiresAt: { gt: now },
        startAt: { gte: now, lte: horizon },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.availabilityException.findMany({
      where: { organizationId: advisor.organizationId, advisorId, date: { gte: now, lte: horizon } },
      orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
    }),
    prisma.meetingType.findMany({
      where: { organizationId: advisor.organizationId, isPublic: true, OR: [{ advisorId }, { advisorId: null }] },
      orderBy: { name: "asc" },
    }),
    getExternalCalendarBusyRanges({ organizationId: advisor.organizationId, advisorId, start: now, end: horizon }),
  ])

  const services = meetingTypes.length
    ? meetingTypes.map((item) => ({
      id: item.id,
      label: item.name,
      durationMinutes: item.durationMinutes,
      slotStepMinutes: item.slotStepMinutes ?? defaultSlotStepMinutes,
      bufferBeforeMinutes: item.bufferBeforeMinutes ?? 0,
      bufferAfterMinutes: item.bufferAfterMinutes ?? defaultBufferAfterMinutes,
      minimumNoticeHours: item.minimumNoticeHours ?? defaultMinimumNoticeHours,
      maxBookingsPerDay: item.maxBookingsPerDay,
      locationType: item.locationType,
      description: item.description ?? "Rendez-vous avec votre conseiller.",
      questionnaire: normalizeQuestionnaire(item.questionnaire),
    }))
    : defaultMeetingTypes.map((item) => ({
      id: item.id,
      label: item.name,
      durationMinutes: item.durationMinutes,
      slotStepMinutes: item.slotStepMinutes ?? defaultSlotStepMinutes,
      bufferBeforeMinutes: item.bufferBeforeMinutes ?? 0,
      bufferAfterMinutes: item.bufferAfterMinutes ?? defaultBufferAfterMinutes,
      minimumNoticeHours: item.minimumNoticeHours ?? defaultMinimumNoticeHours,
      maxBookingsPerDay: item.maxBookingsPerDay,
      locationType: item.locationType,
      description: item.description,
      questionnaire: normalizeQuestionnaire(item.questionnaire),
    }))

  const taskRanges = bookedTasks.flatMap((task) => {
    if (!task.dueDate) return []
    return [{
      start: task.dueDate.toISOString(),
      end: new Date(task.dueDate.getTime() + defaultMeetingDurationMinutes * 60 * 1000).toISOString(),
    }]
  })

  return {
    advisor: {
      id: advisor.id,
      name: advisorProfile.publicName,
      email: advisor.email,
      title: advisor.title,
      phone: advisor.phone,
      avatarUrl: advisorProfile.avatarUrl ?? advisor.avatarUrl,
      publicSlug: advisorProfile.publicSlug,
      publicDescription: advisorProfile.publicDescription,
      bookingEnabled: advisorProfile.bookingEnabled,
      timezone: advisorProfile.timezone,
      organization: advisor.organization,
    },
    slots,
    bookedStarts: bookedTasks.flatMap((task) => task.dueDate ? [task.dueDate.toISOString()] : []),
    bookedRanges: [
      ...taskRanges,
      ...calendarEvents.map((event) => ({ start: event.startAt.toISOString(), end: event.endAt.toISOString() })),
      ...bookings.map((booking) => ({ start: booking.startAt.toISOString(), end: booking.endAt.toISOString() })),
      ...holds.map((hold) => ({ start: hold.startAt.toISOString(), end: hold.endAt.toISOString() })),
      ...externalBusyRanges.map((range) => ({ start: range.start.toISOString(), end: range.end.toISOString(), source: range.source })),
    ],
    exceptions: exceptions.map((exception) => ({
      date: exception.date.toISOString(),
      startMinutes: exception.startMinutes,
      endMinutes: exception.endMinutes,
      type: exception.type,
    })),
    services,
  }
}
