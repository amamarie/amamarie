import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { cancelExternalCalendarEvent, syncExternalCalendarEvent } from "@/lib/calendar/external"
import { getServerAvailableSlots } from "@/lib/calendar/server-availability"
import { prisma } from "@/lib/prisma"

const rescheduleSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string().trim().min(1).default("America/Toronto"),
})
const publicChangeNoticeHours = 24

function publicBookingPayload(booking: {
  id: string
  startAt: Date
  endAt: Date
  timezone: string
  status: string
  clientName: string
  clientEmail: string
  clientPhone: string | null
  message: string | null
  rescheduleToken: string | null
  cancellationToken: string | null
  advisor: { name: string | null; email: string }
}) {
  return {
    id: booking.id,
    startAt: booking.startAt.toISOString(),
    endAt: booking.endAt.toISOString(),
    timezone: booking.timezone,
    status: booking.status,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
    clientPhone: booking.clientPhone,
    message: booking.message,
    advisorName: booking.advisor.name ?? booking.advisor.email,
    advisorEmail: booking.advisor.email,
    canReschedule: booking.status === "CONFIRMED" && Boolean(booking.rescheduleToken),
    canCancel: booking.status === "CONFIRMED" && Boolean(booking.cancellationToken),
  }
}

async function findPublicBooking(token: string) {
  return prisma.booking.findFirst({
    where: {
      OR: [
        { cancellationToken: token },
        { rescheduleToken: token },
      ],
    },
    include: { advisor: { select: { name: true, email: true } } },
  })
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const booking = await findPublicBooking(token)
    if (!booking) return fail("NOT_FOUND", "Ce rendez-vous est introuvable.", 404)

    return ok(publicBookingPayload(booking))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const booking = await prisma.booking.findUnique({
      where: { cancellationToken: token },
      include: { advisor: { select: { name: true, email: true } } },
    })
    if (!booking) return fail("NOT_FOUND", "Ce lien d’annulation est invalide.", 404)
    if (booking.status !== "CONFIRMED") return fail("BOOKING_NOT_ACTIVE", "Ce rendez-vous n’est plus modifiable.", 409)
    if (booking.startAt.getTime() - Date.now() < publicChangeNoticeHours * 60 * 60 * 1000) {
      return fail("BOOKING_CHANGE_TOO_LATE", `Annulation impossible moins de ${publicChangeNoticeHours} h avant le rendez-vous. Veuillez contacter le cabinet.`, 409)
    }
    const calendarEvent = booking.calendarEventId ? await prisma.calendarEvent.findFirst({
      where: { id: booking.calendarEventId, organizationId: booking.organizationId },
      select: { advisorId: true, source: true, externalEventId: true },
    }) : null
    if (calendarEvent) {
      await cancelExternalCalendarEvent({
        organizationId: booking.organizationId,
        advisorId: calendarEvent.advisorId,
        source: calendarEvent.source,
        externalEventId: calendarEvent.externalEventId,
      })
    }

    await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED" },
      }),
      ...(booking.calendarEventId ? [
        prisma.calendarEvent.updateMany({
          where: { id: booking.calendarEventId, organizationId: booking.organizationId },
          data: { status: "CANCELLED" },
        }),
      ] : []),
      ...(booking.taskId ? [
        prisma.task.updateMany({
          where: { id: booking.taskId, organizationId: booking.organizationId },
          data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelReason: "Annulation depuis le lien public de réservation.",
          },
        }),
      ] : []),
    ])

    return ok({ status: "CANCELLED" })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const payload = rescheduleSchema.parse(await request.json())
    const booking = await prisma.booking.findUnique({
      where: { rescheduleToken: token },
      include: { advisor: { select: { name: true, email: true } } },
    })
    if (!booking) return fail("NOT_FOUND", "Ce lien de modification est invalide.", 404)
    if (booking.status !== "CONFIRMED") return fail("BOOKING_NOT_ACTIVE", "Ce rendez-vous n’est plus modifiable.", 409)
    if (booking.startAt.getTime() - Date.now() < publicChangeNoticeHours * 60 * 60 * 1000) {
      return fail("BOOKING_CHANGE_TOO_LATE", `Modification impossible moins de ${publicChangeNoticeHours} h avant le rendez-vous. Veuillez contacter le cabinet.`, 409)
    }

    const startAt = new Date(payload.startAt)
    const endAt = new Date(payload.endAt)
    if (endAt <= startAt) return fail("INVALID_RANGE", "L’heure de fin doit être après l’heure de début.", 422)

    const availability = await getServerAvailableSlots({
      organizationId: booking.organizationId,
      advisorId: booking.advisorId,
      date: startAt,
      meetingTypeId: booking.meetingTypeId,
      timezone: payload.timezone,
      excludeBookingId: booking.id,
      excludeCalendarEventId: booking.calendarEventId,
    })
    const slotIsAvailable = availability.slots.some((slot) => {
      const slotStart = new Date(slot.start)
      const slotEnd = new Date(slot.end)
      return slotStart.getTime() === startAt.getTime() && slotEnd.getTime() === endAt.getTime()
    })
    if (!slotIsAvailable) return fail("SLOT_UNAVAILABLE", "Ce créneau n’est plus disponible.", 409)

    const slotReserved = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.advisorId}))`
      const [conflictingEvent, conflictingBooking, conflictingHold] = await Promise.all([
        tx.calendarEvent.findFirst({
          where: {
            organizationId: booking.organizationId,
            advisorId: booking.advisorId,
            id: booking.calendarEventId ? { not: booking.calendarEventId } : undefined,
            status: { notIn: ["CANCELLED", "ARCHIVED"] },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
          select: { id: true },
        }),
        tx.booking.findFirst({
          where: {
            organizationId: booking.organizationId,
            advisorId: booking.advisorId,
            id: { not: booking.id },
            status: { notIn: ["CANCELLED", "ARCHIVED"] },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
          select: { id: true },
        }),
        tx.bookingHold.findFirst({
          where: {
            organizationId: booking.organizationId,
            advisorId: booking.advisorId,
            status: "ACTIVE",
            expiresAt: { gt: new Date() },
            startAt: { lt: endAt },
            endAt: { gt: startAt },
          },
          select: { id: true },
        }),
      ])
      return !(conflictingEvent || conflictingBooking || conflictingHold)
    })
    if (!slotReserved) return fail("SLOT_UNAVAILABLE", "Ce créneau vient d’être réservé. Choisissez une autre heure.", 409)

    const calendarEvent = booking.calendarEventId ? await prisma.calendarEvent.findFirst({
      where: { id: booking.calendarEventId, organizationId: booking.organizationId },
    }) : null
    const external = calendarEvent ? await syncExternalCalendarEvent({
      organizationId: booking.organizationId,
      advisorId: calendarEvent.advisorId,
      externalEventId: calendarEvent.externalEventId,
      source: calendarEvent.source,
      title: calendarEvent.title,
      description: calendarEvent.description,
      start: startAt,
      end: endAt,
      timezone: payload.timezone,
      locationType: calendarEvent.locationType as "VIDEO" | "PHONE" | "IN_PERSON",
      meetingProvider: calendarEvent.source === "OUTLOOK_CALENDAR" ? "TEAMS" : "GOOGLE_MEET",
      attendeeEmail: booking.clientEmail,
    }) : null

    const updated = await prisma.$transaction(async (tx) => {
      const nextBooking = await tx.booking.update({
        where: { id: booking.id },
        data: { startAt, endAt, timezone: payload.timezone },
        include: { advisor: { select: { name: true, email: true } } },
      })

      if (booking.calendarEventId) {
        await tx.calendarEvent.updateMany({
          where: { id: booking.calendarEventId, organizationId: booking.organizationId },
          data: {
            startAt,
            endAt,
            timezone: payload.timezone,
            meetingUrl: external?.meetingUrl ?? undefined,
            externalEventId: external?.externalEventId ?? undefined,
            source: external?.source ?? undefined,
          },
        })
      }

      if (booking.taskId) {
        await tx.task.updateMany({
          where: { id: booking.taskId, organizationId: booking.organizationId },
          data: { startDate: startAt, dueDate: startAt },
        })
      }

      return nextBooking
    })

    return ok(publicBookingPayload(updated))
  } catch (error) {
    return handleApiError(error)
  }
}
