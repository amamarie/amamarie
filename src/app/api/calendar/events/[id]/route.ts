import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { cancelExternalCalendarEvent, syncExternalCalendarEvent } from "@/lib/calendar/external"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

const updateEventSchema = z.object({
  title: z.string().trim().min(1).max(220).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  type: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  priority: z.string().trim().min(1).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  timezone: z.string().trim().min(1).optional(),
  locationType: z.enum(["VIDEO", "PHONE", "IN_PERSON"]).optional(),
  meetingProvider: z.enum(["GOOGLE_MEET", "TEAMS", "ZOOM"]).optional().nullable(),
  clientId: z.string().trim().min(1).optional().nullable(),
  leadId: z.string().trim().min(1).optional().nullable(),
  advisorId: z.string().trim().min(1).optional().nullable(),
  visibility: z.string().trim().min(1).optional(),
})

async function canEditEvent({ organizationId, userId, advisorId }: { organizationId: string; userId: string; advisorId: string }) {
  if (advisorId === userId) return true
  const permission = await prisma.calendarPermission.findFirst({
    where: { organizationId, viewerUserId: userId, targetUserId: advisorId, permissionLevel: { in: ["EDIT_EVENTS", "ADMIN"] } },
    select: { id: true },
  })
  return Boolean(permission)
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const event = await prisma.calendarEvent.findFirst({ where: { id, organizationId } })
    if (!event) return fail("NOT_FOUND", "Événement introuvable.", 404)
    if (!await canEditEvent({ organizationId, userId, advisorId: event.advisorId })) return fail("FORBIDDEN", "Permission calendrier insuffisante.", 403)

    const payload = updateEventSchema.parse(await request.json())
    const nextStart = payload.startAt ?? event.startAt
    const nextEnd = payload.endAt ?? event.endAt
    const nextAdvisorId = payload.advisorId ?? event.advisorId
    const nextLocationType = payload.locationType ?? event.locationType as "VIDEO" | "PHONE" | "IN_PERSON"
    if (nextEnd <= nextStart) return fail("VALIDATION_ERROR", "L'heure de fin doit être après l'heure de début.", 422)
    const nextClientId = payload.clientId === undefined ? event.clientId : payload.clientId || null
    const client = nextClientId ? await prisma.client.findFirst({
      where: { id: nextClientId, organizationId },
      select: { email: true, emailPrimary: true, emailSecondary: true },
    }) : null
    const shouldRefreshExternal = Boolean(payload.startAt || payload.endAt || payload.locationType || payload.meetingProvider || payload.title || payload.description || payload.clientId)
    const external = shouldRefreshExternal ? await syncExternalCalendarEvent({
      organizationId,
      advisorId: nextAdvisorId,
      externalEventId: event.externalEventId,
      source: event.source,
      title: payload.title ?? event.title,
      description: payload.description === undefined ? event.description : payload.description,
      start: nextStart,
      end: nextEnd,
      timezone: payload.timezone ?? event.timezone,
      locationType: nextLocationType,
      meetingProvider: payload.meetingProvider,
      attendeeEmail: client?.emailPrimary ?? client?.email ?? client?.emailSecondary ?? null,
    }) : null

    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...payload,
        clientId: payload.clientId === undefined ? undefined : payload.clientId || null,
        leadId: payload.leadId === undefined ? undefined : payload.leadId || null,
        advisorId: payload.advisorId ?? undefined,
        meetingUrl: external?.meetingUrl ?? undefined,
        externalEventId: external?.externalEventId ?? undefined,
        source: external?.source ?? undefined,
      },
    })
    return ok(updated)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const event = await prisma.calendarEvent.findFirst({ where: { id, organizationId } })
    if (!event) return fail("NOT_FOUND", "Événement introuvable.", 404)
    if (!await canEditEvent({ organizationId, userId, advisorId: event.advisorId })) return fail("FORBIDDEN", "Permission calendrier insuffisante.", 403)
    await cancelExternalCalendarEvent({ organizationId, advisorId: event.advisorId, source: event.source, externalEventId: event.externalEventId })
    const updated = await prisma.calendarEvent.update({ where: { id }, data: { status: "CANCELLED" } })
    return ok(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
