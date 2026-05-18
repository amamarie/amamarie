const zoomTokenUrl = "https://zoom.us/oauth/token"
const zoomMeetingsUrl = "https://api.zoom.us/v2/users/me/meetings"

type ZoomTokenResponse = {
  access_token?: string
  error?: string
  reason?: string
}

type ZoomMeetingResponse = {
  id?: number
  join_url?: string
  start_url?: string
  error?: { message?: string }
  message?: string
}

function zoomAccountId() {
  return process.env.ZOOM_ACCOUNT_ID?.trim()
}

function zoomClientId() {
  return process.env.ZOOM_CLIENT_ID?.trim()
}

function zoomClientSecret() {
  return process.env.ZOOM_CLIENT_SECRET?.trim()
}

export function isZoomConfigured() {
  return Boolean(zoomAccountId() && zoomClientId() && zoomClientSecret())
}

async function getZoomAccessToken() {
  const accountId = zoomAccountId()
  const clientId = zoomClientId()
  const clientSecret = zoomClientSecret()
  if (!accountId || !clientId || !clientSecret) throw new Error("ZOOM_NOT_CONFIGURED")

  const response = await fetch(`${zoomTokenUrl}?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
  })
  const data = await response.json().catch(() => ({})) as ZoomTokenResponse
  if (!response.ok || !data.access_token) throw new Error(`ZOOM_TOKEN_FAILED:${data.reason ?? data.error ?? response.status}`)
  return data.access_token
}

export async function createZoomMeeting({
  topic,
  agenda,
  start,
  durationMinutes,
  timezone,
}: {
  topic: string
  agenda?: string | null
  start: Date
  durationMinutes: number
  timezone?: string | null
}) {
  if (!isZoomConfigured()) return null
  const accessToken = await getZoomAccessToken()
  const response = await fetch(zoomMeetingsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic,
      agenda,
      type: 2,
      start_time: start.toISOString(),
      duration: durationMinutes,
      timezone: timezone ?? "UTC",
      settings: {
        join_before_host: false,
        waiting_room: true,
      },
    }),
  })
  const data = await response.json().catch(() => ({})) as ZoomMeetingResponse
  if (!response.ok) throw new Error(`ZOOM_MEETING_FAILED:${response.status}:${data.message ?? data.error?.message ?? "Zoom API error"}`)
  return { id: data.id ? String(data.id) : undefined, url: data.join_url, meetingUrl: data.join_url, provider: "ZOOM" as const }
}

export async function updateZoomMeeting({
  meetingId,
  topic,
  agenda,
  start,
  durationMinutes,
  timezone,
}: {
  meetingId: string
  topic: string
  agenda?: string | null
  start: Date
  durationMinutes: number
  timezone?: string | null
}) {
  if (!isZoomConfigured()) return false
  const accessToken = await getZoomAccessToken()
  const response = await fetch(`${zoomMeetingsUrl}/${encodeURIComponent(meetingId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      topic,
      agenda,
      start_time: start.toISOString(),
      duration: durationMinutes,
      timezone: timezone ?? "UTC",
    }),
  })
  if (!response.ok && response.status !== 204) {
    const data = await response.json().catch(() => ({})) as ZoomMeetingResponse
    throw new Error(`ZOOM_MEETING_UPDATE_FAILED:${response.status}:${data.message ?? data.error?.message ?? "Zoom API error"}`)
  }
  return true
}

export async function deleteZoomMeeting({ meetingId }: { meetingId: string }) {
  if (!isZoomConfigured()) return false
  const accessToken = await getZoomAccessToken()
  const response = await fetch(`${zoomMeetingsUrl}/${encodeURIComponent(meetingId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok && response.status !== 204 && response.status !== 404) {
    const data = await response.json().catch(() => ({})) as ZoomMeetingResponse
    throw new Error(`ZOOM_MEETING_DELETE_FAILED:${response.status}:${data.message ?? data.error?.message ?? "Zoom API error"}`)
  }
  return true
}
