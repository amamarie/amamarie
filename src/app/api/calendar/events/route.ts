import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createExternalCalendarEvent } from "@/lib/calendar/external"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const eventSchema = z.object({
  title: z.string().trim().min(1).max(220),
  description: z.string().trim().max(2000).optional().nullable(),
  type: z.string().trim().min(1).default("MEETING"),
  status: z.string().trim().min(1).default("CONFIRMED"),
  priority: z.string().trim().min(1).default("NORMAL"),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  timezone: z.string().trim().min(1).default("America/Toronto"),
  locationType: z.enum(["VIDEO", "PHONE", "IN_PERSON"]).default("VIDEO"),
  meetingProvider: z.enum(["GOOGLE_MEET", "TEAMS", "ZOOM"]).optional().nullable(),
  clientId: z.string().trim().min(1).optional().nullable(),
  leadId: z.string().trim().min(1).optional().nullable(),
  taskId: z.string().trim().min(1).optional().nullable(),
  advisorId: z.string().trim().min(1).optional().nullable(),
  visibility: z.string().trim().min(1).default("DETAILS"),
}).refine((payload) => payload.endAt > payload.startAt, {
  message: "L'heure de fin doit être après l'heure de début.",
  path: ["endAt"],
})

export async function GET(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const url = new URL(request.url)
    const start = url.searchParams.get("start") ? new Date(url.searchParams.get("start")!) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = url.searchParams.get("end") ? new Date(url.searchParams.get("end")!) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    const advisorId = url.searchParams.get("advisorId")

    const events = await prisma.calendarEvent.findMany({
      where: {
        organizationId,
        ...(advisorId ? { advisorId } : {}),
        status: { not: "CANCELLED" },
        OR: [
          { startAt: { gte: start, lte: end } },
          { endAt: { gte: start, lte: end } },
        ],
      },
      orderBy: { startAt: "asc" },
    })

    const permissions = await prisma.calendarPermission.findMany({ where: { organizationId, viewerUserId: userId } })
    const visible = events.map((event) => {
      const canViewDetails = event.advisorId === userId || permissions.some((permission) => permission.targetUserId === event.advisorId && ["VIEW_DETAILS", "EDIT_EVENTS", "ADMIN"].includes(permission.permissionLevel))
      return canViewDetails ? event : { ...event, title: "Occupé", description: null, clientId: null, leadId: null, visibility: "FREE_BUSY_ONLY" }
    })

    return ok(visible)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = eventSchema.parse(await request.json())
    const advisorId = payload.advisorId ?? userId
    const advisor = await prisma.user.findFirst({ where: { id: advisorId, organizationId }, select: { id: true } })
    if (!advisor) return fail("NOT_FOUND", "Conseiller introuvable.", 404)
    const client = payload.clientId ? await prisma.client.findFirst({
      where: { id: payload.clientId, organizationId },
      select: { email: true, emailPrimary: true, emailSecondary: true },
    }) : null
    const external = await createExternalCalendarEvent({
      organizationId,
      advisorId,
      title: payload.title,
      description: payload.description,
      start: payload.startAt,
      end: payload.endAt,
      timezone: payload.timezone,
      locationType: payload.locationType,
      meetingProvider: payload.meetingProvider,
      attendeeEmail: client?.emailPrimary ?? client?.email ?? client?.emailSecondary ?? null,
    })

    const event = await prisma.calendarEvent.create({
      data: {
        organizationId,
        advisorId,
        createdById: userId,
        title: payload.title,
        description: payload.description,
        type: payload.type,
        status: payload.status,
        priority: payload.priority,
        startAt: payload.startAt,
        endAt: payload.endAt,
        timezone: payload.timezone,
        locationType: payload.locationType,
        meetingUrl: external.meetingUrl,
        externalEventId: external.externalEventId,
        clientId: payload.clientId || null,
        leadId: payload.leadId || null,
        taskId: payload.taskId || null,
        visibility: payload.visibility,
        source: external.source,
      },
    })

    return ok(event, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
