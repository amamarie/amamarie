import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { rangesOverlap } from "@/lib/calendar/availability"
import { getExternalCalendarBusyRanges } from "@/lib/calendar/external"
import { prisma } from "@/lib/prisma"

const holdSchema = z.object({
  meetingTypeId: z.string().trim().min(1).optional().nullable(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  timezone: z.string().trim().min(1).default("America/Toronto"),
  clientEmail: z.string().trim().email().optional().nullable(),
}).refine((payload) => payload.endAt > payload.startAt, {
  message: "Créneau invalide.",
  path: ["endAt"],
})

export async function POST(request: Request, { params }: { params: Promise<{ advisorId: string }> }) {
  try {
    const { advisorId } = await params
    const payload = holdSchema.parse(await request.json())
    const advisor = await prisma.user.findUnique({ where: { id: advisorId }, select: { id: true, organizationId: true } })
    if (!advisor) return fail("NOT_FOUND", "Ce calendrier n’est pas disponible.", 404)

    await prisma.bookingHold.updateMany({
      where: { organizationId: advisor.organizationId, advisorId, status: "ACTIVE", expiresAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    })

    const [events, tasks, bookings, holds, externalBusy] = await Promise.all([
      prisma.calendarEvent.findMany({
        where: {
          organizationId: advisor.organizationId,
          advisorId,
          status: { notIn: ["CANCELLED", "ARCHIVED"] },
          startAt: { lt: payload.endAt },
          endAt: { gt: payload.startAt },
        },
        select: { startAt: true, endAt: true },
      }),
      prisma.task.findMany({
        where: {
          organizationId: advisor.organizationId,
          assignedToId: advisorId,
          type: "MEETING",
          status: { notIn: ["CANCELLED", "ARCHIVED", "DONE"] },
          dueDate: { gte: new Date(payload.startAt.getTime() - 60 * 60 * 1000), lt: payload.endAt },
        },
        select: { dueDate: true },
      }),
      prisma.booking.findMany({
        where: {
          organizationId: advisor.organizationId,
          advisorId,
          status: { notIn: ["CANCELLED", "ARCHIVED"] },
          startAt: { lt: payload.endAt },
          endAt: { gt: payload.startAt },
        },
        select: { startAt: true, endAt: true },
      }),
      prisma.bookingHold.findMany({
        where: {
          organizationId: advisor.organizationId,
          advisorId,
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
          startAt: { lt: payload.endAt },
          endAt: { gt: payload.startAt },
        },
        select: { startAt: true, endAt: true },
      }),
      getExternalCalendarBusyRanges({ organizationId: advisor.organizationId, advisorId, start: payload.startAt, end: payload.endAt, timezone: payload.timezone }),
    ])

    const busy = [
      ...events,
      ...tasks.flatMap((task) => task.dueDate ? [{ startAt: task.dueDate, endAt: new Date(task.dueDate.getTime() + 60 * 60 * 1000) }] : []),
      ...bookings,
      ...holds,
      ...externalBusy.map((range) => ({ startAt: range.start, endAt: range.end })),
    ]
    if (busy.some((range) => rangesOverlap(payload.startAt, payload.endAt, range.startAt, range.endAt))) {
      return fail("SLOT_UNAVAILABLE", "Ce créneau vient d’être réservé. Choisissez une autre heure.", 409)
    }

    const hold = await prisma.bookingHold.create({
      data: {
        organizationId: advisor.organizationId,
        advisorId,
        meetingTypeId: payload.meetingTypeId,
        startAt: payload.startAt,
        endAt: payload.endAt,
        timezone: payload.timezone,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        clientEmail: payload.clientEmail,
      },
    })

    return ok(hold, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
