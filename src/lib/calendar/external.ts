import { generateMeetingUrl } from "@/lib/calendar/types"
import { createAdvisorGoogleCalendarEvent, deleteAdvisorGoogleCalendarEvent, getAdvisorGoogleCalendarBusyRanges, updateAdvisorGoogleCalendarEvent } from "@/lib/google/gmail"
import { createAdvisorOutlookCalendarEvent, deleteAdvisorOutlookCalendarEvent, getAdvisorOutlookBusyRanges, updateAdvisorOutlookCalendarEvent } from "@/lib/microsoft/calendar"
import { prisma } from "@/lib/prisma"
import { createZoomMeeting, deleteZoomMeeting, updateZoomMeeting } from "@/lib/zoom/meetings"

export type BusyRange = {
  start: Date
  end: Date
  source: "GOOGLE_CALENDAR" | "OUTLOOK_CALENDAR"
}

export async function getExternalCalendarBusyRanges({
  organizationId,
  advisorId,
  start,
  end,
  timezone = "UTC",
}: {
  organizationId: string
  advisorId: string
  start: Date
  end: Date
  timezone?: string
}): Promise<BusyRange[]> {
  const [googleRanges, outlookRanges] = await Promise.allSettled([
    getAdvisorGoogleCalendarBusyRanges({ organizationId, userId: advisorId, start, end }),
    getAdvisorOutlookBusyRanges({ organizationId, userId: advisorId, start, end, timezone }),
  ])

  return [
    ...(googleRanges.status === "fulfilled" ? googleRanges.value.map((range) => ({ ...range, source: "GOOGLE_CALENDAR" as const })) : []),
    ...(outlookRanges.status === "fulfilled" ? outlookRanges.value.map((range) => ({ ...range, source: "OUTLOOK_CALENDAR" as const })) : []),
  ]
}

export async function createExternalCalendarEvent({
  organizationId,
  advisorId,
  title,
  description,
  start,
  end,
  timezone,
  locationType,
  meetingProvider,
  attendeeEmail,
}: {
  organizationId: string
  advisorId: string
  title: string
  description?: string | null
  start: Date
  end: Date
  timezone?: string | null
  locationType: "VIDEO" | "PHONE" | "IN_PERSON"
  meetingProvider?: "GOOGLE_MEET" | "TEAMS" | "ZOOM" | null
  attendeeEmail?: string | null
}) {
  if (locationType !== "VIDEO") return { meetingUrl: generateMeetingUrl(locationType, null), externalEventId: null, source: "INTERNAL" }

  if (meetingProvider === "TEAMS") {
    const event = await createAdvisorOutlookCalendarEvent({
      organizationId,
      userId: advisorId,
      summary: title,
      description,
      start,
      end,
      timezone,
      attendeeEmail,
      createTeamsLink: true,
    }).catch(() => null)
    if (event) return { meetingUrl: event.meetingUrl ?? event.url ?? null, externalEventId: event.id ?? null, source: event.provider }
  }

  if (meetingProvider === "ZOOM") {
    const event = await createZoomMeeting({
      topic: title,
      agenda: description,
      start,
      durationMinutes: Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000)),
      timezone,
    }).catch(() => null)
    if (event) return { meetingUrl: event.meetingUrl ?? event.url ?? null, externalEventId: event.id ?? null, source: event.provider }
  }

  const event = await createAdvisorGoogleCalendarEvent({
    organizationId,
    userId: advisorId,
    summary: title,
    description: description ?? undefined,
    start,
    end,
    attendeeEmail,
    timezone,
    createMeetLink: meetingProvider === "GOOGLE_MEET" || !meetingProvider,
  }).catch(() => null)
  if (event) return { meetingUrl: event.meetingUrl ?? event.url ?? null, externalEventId: event.id ?? null, source: event.provider }

  const connected = await prisma.externalCalendarConnection.findFirst({
    where: { organizationId, userId: advisorId, status: "CONNECTED", syncEnabled: true },
    select: { provider: true },
  })
  return {
    meetingUrl: generateMeetingUrl(locationType, meetingProvider),
    externalEventId: null,
    source: connected?.provider ?? "INTERNAL",
  }
}

export async function syncExternalCalendarEvent({
  organizationId,
  advisorId,
  externalEventId,
  source,
  title,
  description,
  start,
  end,
  timezone,
  locationType,
  meetingProvider,
  attendeeEmail,
}: {
  organizationId: string
  advisorId: string
  externalEventId?: string | null
  source?: string | null
  title: string
  description?: string | null
  start: Date
  end: Date
  timezone?: string | null
  locationType: "VIDEO" | "PHONE" | "IN_PERSON"
  meetingProvider?: "GOOGLE_MEET" | "TEAMS" | "ZOOM" | null
  attendeeEmail?: string | null
}) {
  if (!externalEventId || !source || source === "INTERNAL" || source === "PUBLIC_BOOKING") {
    return createExternalCalendarEvent({ organizationId, advisorId, title, description, start, end, timezone, locationType, meetingProvider, attendeeEmail })
  }

  if (source === "GOOGLE_CALENDAR") {
    const event = await updateAdvisorGoogleCalendarEvent({
      organizationId,
      userId: advisorId,
      eventId: externalEventId,
      summary: title,
      description: description ?? undefined,
      start,
      end,
      timezone,
      attendeeEmail,
    }).catch(() => null)
    if (event) return { meetingUrl: event.meetingUrl ?? event.url ?? null, externalEventId: event.id ?? externalEventId, source: event.provider }
  }

  if (source === "OUTLOOK_CALENDAR") {
    const event = await updateAdvisorOutlookCalendarEvent({
      organizationId,
      userId: advisorId,
      eventId: externalEventId,
      summary: title,
      description,
      start,
      end,
      timezone,
      attendeeEmail,
    }).catch(() => null)
    if (event) return { meetingUrl: null, externalEventId: event.id ?? externalEventId, source: event.provider }
  }

  if (source === "ZOOM") {
    const updated = await updateZoomMeeting({
      meetingId: externalEventId,
      topic: title,
      agenda: description,
      start,
      durationMinutes: Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000)),
      timezone,
    }).catch(() => false)
    if (updated) return { meetingUrl: null, externalEventId, source: "ZOOM" }
  }

  return createExternalCalendarEvent({ organizationId, advisorId, title, description, start, end, timezone, locationType, meetingProvider, attendeeEmail })
}

export async function cancelExternalCalendarEvent({
  organizationId,
  advisorId,
  source,
  externalEventId,
}: {
  organizationId: string
  advisorId: string
  source?: string | null
  externalEventId?: string | null
}) {
  if (!source || !externalEventId) return false
  if (source === "GOOGLE_CALENDAR") {
    return deleteAdvisorGoogleCalendarEvent({ organizationId, userId: advisorId, eventId: externalEventId }).catch(() => false)
  }
  if (source === "OUTLOOK_CALENDAR") {
    return deleteAdvisorOutlookCalendarEvent({ organizationId, userId: advisorId, eventId: externalEventId }).catch(() => false)
  }
  if (source === "ZOOM") {
    return deleteZoomMeeting({ meetingId: externalEventId }).catch(() => false)
  }
  return false
}
