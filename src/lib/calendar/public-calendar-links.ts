type PublicCalendarBooking = {
  id: string
  startAt: Date
  endAt: Date
  timezone: string
  clientName: string
  clientEmail: string
  message?: string | null
  rescheduleToken?: string | null
  cancellationToken?: string | null
  advisor: { name: string | null; email: string }
  meetingType?: { name: string } | null
}

function compactUtcDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
}

function foldIcsLine(line: string) {
  const limit = 74
  if (line.length <= limit) return line

  const lines: string[] = []
  let remaining = line
  while (remaining.length > limit) {
    lines.push(remaining.slice(0, limit))
    remaining = ` ${remaining.slice(limit)}`
  }
  lines.push(remaining)
  return lines.join("\r\n")
}

function eventTitle(booking: PublicCalendarBooking) {
  return booking.meetingType?.name
    ? `Rendez-vous - ${booking.meetingType.name}`
    : "Rendez-vous conseiller"
}

function eventDescription(booking: PublicCalendarBooking, origin: string) {
  const manageToken = booking.rescheduleToken ?? booking.cancellationToken
  return [
    `Rendez-vous avec ${booking.advisor.name ?? booking.advisor.email}.`,
    `Client: ${booking.clientName}`,
    `Courriel client: ${booking.clientEmail}`,
    booking.message ? `Message: ${booking.message}` : null,
    manageToken ? `Modifier ou annuler: ${origin}/rendez-vous/gerer/${manageToken}` : null,
  ].filter(Boolean).join("\n")
}

export function publicCalendarLinks(booking: PublicCalendarBooking, origin: string) {
  const token = booking.rescheduleToken ?? booking.cancellationToken ?? booking.id
  const title = eventTitle(booking)
  const description = eventDescription(booking, origin)
  const startIso = booking.startAt.toISOString()
  const endIso = booking.endAt.toISOString()
  const google = new URL("https://calendar.google.com/calendar/render")
  google.searchParams.set("action", "TEMPLATE")
  google.searchParams.set("text", title)
  google.searchParams.set("dates", `${compactUtcDate(booking.startAt)}/${compactUtcDate(booking.endAt)}`)
  google.searchParams.set("details", description)
  google.searchParams.set("ctz", booking.timezone)

  const outlook = new URL("https://outlook.live.com/calendar/0/deeplink/compose")
  outlook.searchParams.set("path", "/calendar/action/compose")
  outlook.searchParams.set("rru", "addevent")
  outlook.searchParams.set("subject", title)
  outlook.searchParams.set("startdt", startIso)
  outlook.searchParams.set("enddt", endIso)
  outlook.searchParams.set("body", description)

  const office = new URL("https://outlook.office.com/calendar/0/deeplink/compose")
  office.searchParams.set("path", "/calendar/action/compose")
  office.searchParams.set("rru", "addevent")
  office.searchParams.set("subject", title)
  office.searchParams.set("startdt", startIso)
  office.searchParams.set("enddt", endIso)
  office.searchParams.set("body", description)

  return {
    title,
    description,
    google: google.toString(),
    outlook: outlook.toString(),
    office: office.toString(),
    ics: `${origin}/api/public/bookings/${token}/calendar.ics`,
  }
}

export function bookingIcs(booking: PublicCalendarBooking, origin: string) {
  const links = publicCalendarLinks(booking, origin)
  const uid = `${booking.id}@finadvisor`
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FinAdvisor CRM//Public Booking//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${compactUtcDate(new Date())}`,
    `DTSTART:${compactUtcDate(booking.startAt)}`,
    `DTEND:${compactUtcDate(booking.endAt)}`,
    `SUMMARY:${escapeIcs(links.title)}`,
    `DESCRIPTION:${escapeIcs(links.description)}`,
    `ORGANIZER;CN=${escapeIcs(booking.advisor.name ?? "Conseiller")}:MAILTO:${booking.advisor.email}`,
    `ATTENDEE;CN=${escapeIcs(booking.clientName)};ROLE=REQ-PARTICIPANT:MAILTO:${booking.clientEmail}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]

  return lines.map(foldIcsLine).join("\r\n")
}
