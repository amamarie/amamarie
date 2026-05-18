import crypto from "node:crypto"

import { prisma } from "@/lib/prisma"

const authorizeUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
const tokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
const graphMeUrl = "https://graph.microsoft.com/v1.0/me"
const graphCalendarEventsUrl = "https://graph.microsoft.com/v1.0/me/events"
const graphGetScheduleUrl = "https://graph.microsoft.com/v1.0/me/calendar/getSchedule"
const microsoftScopes = ["offline_access", "User.Read", "Calendars.ReadWrite"]

type MicrosoftConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
  stateSecret: string
}

type MicrosoftOAuthState = {
  organizationId: string
  userId: string
  returnTo: string
  issuedAt: number
}

type MicrosoftTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

type MicrosoftUser = {
  mail?: string | null
  userPrincipalName?: string | null
  displayName?: string | null
}

type MicrosoftConnection = {
  id: string
  organizationId: string
  userId: string
  provider: string
  providerAccountEmail: string | null
  accessTokenEncrypted: string | null
  refreshTokenEncrypted: string | null
  syncEnabled: boolean
  lastSyncAt: Date | null
  status: string
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")
  return Buffer.from(padded, "base64").toString("utf8")
}

function signState(payload: string, secret: string) {
  return base64UrlEncode(crypto.createHmac("sha256", secret).update(payload).digest())
}

function resolveMicrosoftClientId() {
  return process.env.MICROSOFT_CLIENT_ID?.trim() || process.env.AZURE_AD_CLIENT_ID?.trim()
}

function resolveMicrosoftClientSecret() {
  return process.env.MICROSOFT_CLIENT_SECRET?.trim() || process.env.AZURE_AD_CLIENT_SECRET?.trim()
}

function resolveStateSecret() {
  return process.env.MICROSOFT_OAUTH_STATE_SECRET?.trim() || process.env.CLERK_SECRET_KEY?.trim()
}

export function isMicrosoftCalendarConfigured() {
  return Boolean(resolveMicrosoftClientId() && resolveMicrosoftClientSecret())
}

export function microsoftCalendarRedirectUri(request: Request) {
  const configured = process.env.MICROSOFT_CALENDAR_REDIRECT_URI?.trim()
  if (configured) return configured
  const origin = new URL(request.url).origin
  return `${origin}/api/integrations/microsoft/calendar/callback`
}

function microsoftConfig(request: Request): MicrosoftConfig {
  const clientId = resolveMicrosoftClientId()
  const clientSecret = resolveMicrosoftClientSecret()
  const stateSecret = resolveStateSecret()
  if (!clientId || !clientSecret || !stateSecret) throw new Error("MICROSOFT_CALENDAR_NOT_CONFIGURED")
  return { clientId, clientSecret, stateSecret, redirectUri: microsoftCalendarRedirectUri(request) }
}

export function createMicrosoftCalendarOAuthUrl({
  request,
  organizationId,
  userId,
  returnTo = "/parametres",
}: {
  request: Request
  organizationId: string
  userId: string
  returnTo?: string
}) {
  const config = microsoftConfig(request)
  const payload = base64UrlEncode(JSON.stringify({ organizationId, userId, returnTo, issuedAt: Date.now() } satisfies MicrosoftOAuthState))
  const state = `${payload}.${signState(payload, config.stateSecret)}`
  const url = new URL(authorizeUrl)
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("response_mode", "query")
  url.searchParams.set("scope", microsoftScopes.join(" "))
  url.searchParams.set("state", state)
  return url
}

export function verifyMicrosoftCalendarOAuthState(request: Request, state: string | null): MicrosoftOAuthState {
  if (!state) throw new Error("MICROSOFT_OAUTH_INVALID_STATE")
  const config = microsoftConfig(request)
  const [payload, signature] = state.split(".")
  if (!payload || !signature) throw new Error("MICROSOFT_OAUTH_INVALID_STATE")
  const expected = signState(payload, config.stateSecret)
  if (signature.length !== expected.length) throw new Error("MICROSOFT_OAUTH_INVALID_STATE")
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("MICROSOFT_OAUTH_INVALID_STATE")
  const parsed = JSON.parse(base64UrlDecode(payload)) as MicrosoftOAuthState
  if (Date.now() - parsed.issuedAt > 10 * 60 * 1000) throw new Error("MICROSOFT_OAUTH_STATE_EXPIRED")
  return parsed
}

async function exchangeCodeForTokens(request: Request, code: string) {
  const config = microsoftConfig(request)
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  })
  const data = await response.json() as MicrosoftTokenResponse
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(`MICROSOFT_TOKEN_EXCHANGE_FAILED:${data.error_description ?? data.error ?? response.status}`)
  }
  return data
}

async function refreshMicrosoftAccessToken(connection: MicrosoftConnection) {
  const clientId = resolveMicrosoftClientId()
  const clientSecret = resolveMicrosoftClientSecret()
  if (!clientId || !clientSecret || !connection.refreshTokenEncrypted) throw new Error("MICROSOFT_CALENDAR_NOT_CONFIGURED")

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refreshTokenEncrypted,
      grant_type: "refresh_token",
    }),
  })
  const data = await response.json() as MicrosoftTokenResponse
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(`MICROSOFT_TOKEN_REFRESH_FAILED:${data.error_description ?? data.error ?? response.status}`)
  }

  const updated = await prisma.externalCalendarConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: data.access_token,
      refreshTokenEncrypted: data.refresh_token ?? connection.refreshTokenEncrypted,
      status: "CONNECTED",
    },
  })
  return updated.accessTokenEncrypted!
}

async function getValidMicrosoftAccessToken(connection: MicrosoftConnection) {
  if (connection.accessTokenEncrypted) return connection.accessTokenEncrypted
  return refreshMicrosoftAccessToken(connection)
}

async function getMicrosoftUser(accessToken: string) {
  const response = await fetch(graphMeUrl, { headers: { Authorization: `Bearer ${accessToken}` } })
  const data = await response.json() as MicrosoftUser
  if (!response.ok) throw new Error("MICROSOFT_USERINFO_FAILED")
  return data
}

export async function saveMicrosoftCalendarConnection({
  request,
  organizationId,
  userId,
  code,
}: {
  request: Request
  organizationId: string
  userId: string
  code: string
}) {
  const tokens = await exchangeCodeForTokens(request, code)
  const profile = await getMicrosoftUser(tokens.access_token!)
  const email = profile.mail ?? profile.userPrincipalName ?? null

  await prisma.externalCalendarConnection.deleteMany({ where: { organizationId, userId, provider: "OUTLOOK_CALENDAR" } })
  return prisma.externalCalendarConnection.create({
    data: {
      organizationId,
      userId,
      provider: "OUTLOOK_CALENDAR",
      providerAccountEmail: email,
      accessTokenEncrypted: tokens.access_token,
      refreshTokenEncrypted: tokens.refresh_token,
      syncEnabled: true,
      lastSyncAt: new Date(),
      status: "CONNECTED",
    },
  })
}

export async function disconnectMicrosoftCalendar({ organizationId, userId }: { organizationId: string; userId: string }) {
  await prisma.externalCalendarConnection.deleteMany({ where: { organizationId, userId, provider: "OUTLOOK_CALENDAR" } })
}

export async function getMicrosoftCalendarConnectionStatus({ organizationId, userId }: { organizationId: string; userId: string }) {
  const connection = await prisma.externalCalendarConnection.findFirst({
    where: { organizationId, userId, provider: "OUTLOOK_CALENDAR" },
    select: { providerAccountEmail: true, status: true, syncEnabled: true, lastSyncAt: true, createdAt: true },
  })
  return {
    configured: isMicrosoftCalendarConfigured(),
    connected: connection?.status === "CONNECTED",
    email: connection?.providerAccountEmail ?? null,
    syncEnabled: connection?.syncEnabled ?? false,
    connectedAt: connection?.createdAt ?? null,
    lastSyncAt: connection?.lastSyncAt ?? null,
  }
}

export async function getAdvisorOutlookBusyRanges({
  organizationId,
  userId,
  start,
  end,
  timezone = "UTC",
}: {
  organizationId: string
  userId: string
  start: Date
  end: Date
  timezone?: string
}) {
  if (!isMicrosoftCalendarConfigured()) return []
  const connection = await prisma.externalCalendarConnection.findFirst({
    where: { organizationId, userId, provider: "OUTLOOK_CALENDAR", status: "CONNECTED", syncEnabled: true },
  })
  if (!connection) return []
  const accessToken = await getValidMicrosoftAccessToken(connection)
  const response = await fetch(graphGetScheduleUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: `outlook.timezone="${timezone}"`,
    },
    body: JSON.stringify({
      schedules: [connection.providerAccountEmail ?? "me"],
      startTime: { dateTime: start.toISOString(), timeZone: "UTC" },
      endTime: { dateTime: end.toISOString(), timeZone: "UTC" },
      availabilityViewInterval: 15,
    }),
  })
  const data = await response.json().catch(() => ({})) as {
    value?: Array<{ scheduleItems?: Array<{ start?: { dateTime?: string }; end?: { dateTime?: string } }> }>
    error?: { message?: string }
  }
  if (!response.ok) throw new Error(`MICROSOFT_GET_SCHEDULE_FAILED:${response.status}:${data.error?.message ?? "Graph API error"}`)
  await prisma.externalCalendarConnection.update({ where: { id: connection.id }, data: { lastSyncAt: new Date(), status: "CONNECTED" } })

  return (data.value ?? []).flatMap((schedule) => (schedule.scheduleItems ?? []).flatMap((item) => (
    item.start?.dateTime && item.end?.dateTime ? [{ start: new Date(item.start.dateTime), end: new Date(item.end.dateTime) }] : []
  )))
}

export async function createAdvisorOutlookCalendarEvent({
  organizationId,
  userId,
  summary,
  description,
  start,
  end,
  timezone = "UTC",
  attendeeEmail,
  createTeamsLink,
}: {
  organizationId: string
  userId: string
  summary: string
  description?: string | null
  start: Date
  end: Date
  timezone?: string | null
  attendeeEmail?: string | null
  createTeamsLink?: boolean
}) {
  if (!isMicrosoftCalendarConfigured()) return null
  const connection = await prisma.externalCalendarConnection.findFirst({
    where: { organizationId, userId, provider: "OUTLOOK_CALENDAR", status: "CONNECTED", syncEnabled: true },
  })
  if (!connection) return null
  const accessToken = await getValidMicrosoftAccessToken(connection)
  const response = await fetch(graphCalendarEventsUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: summary,
      body: { contentType: "HTML", content: description ?? "" },
      start: { dateTime: start.toISOString(), timeZone: timezone ?? "UTC" },
      end: { dateTime: end.toISOString(), timeZone: timezone ?? "UTC" },
      attendees: attendeeEmail ? [{ emailAddress: { address: attendeeEmail }, type: "required" }] : [],
      isOnlineMeeting: Boolean(createTeamsLink),
      onlineMeetingProvider: createTeamsLink ? "teamsForBusiness" : undefined,
    }),
  })
  const data = await response.json().catch(() => ({})) as {
    id?: string
    webLink?: string
    onlineMeeting?: { joinUrl?: string }
    error?: { message?: string }
  }
  if (!response.ok) throw new Error(`MICROSOFT_EVENT_CREATE_FAILED:${response.status}:${data.error?.message ?? "Graph API error"}`)
  await prisma.externalCalendarConnection.update({ where: { id: connection.id }, data: { lastSyncAt: new Date(), status: "CONNECTED" } })
  return { id: data.id, url: data.webLink, meetingUrl: data.onlineMeeting?.joinUrl ?? data.webLink, provider: "OUTLOOK_CALENDAR" as const }
}

export async function updateAdvisorOutlookCalendarEvent({
  organizationId,
  userId,
  eventId,
  summary,
  description,
  start,
  end,
  timezone = "UTC",
  attendeeEmail,
}: {
  organizationId: string
  userId: string
  eventId: string
  summary: string
  description?: string | null
  start: Date
  end: Date
  timezone?: string | null
  attendeeEmail?: string | null
}) {
  if (!isMicrosoftCalendarConfigured()) return null
  const connection = await prisma.externalCalendarConnection.findFirst({
    where: { organizationId, userId, provider: "OUTLOOK_CALENDAR", status: "CONNECTED", syncEnabled: true },
  })
  if (!connection) return null
  const accessToken = await getValidMicrosoftAccessToken(connection)
  const response = await fetch(`${graphCalendarEventsUrl}/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: summary,
      body: { contentType: "HTML", content: description ?? "" },
      start: { dateTime: start.toISOString(), timeZone: timezone ?? "UTC" },
      end: { dateTime: end.toISOString(), timeZone: timezone ?? "UTC" },
      attendees: attendeeEmail ? [{ emailAddress: { address: attendeeEmail }, type: "required" }] : [],
    }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(`MICROSOFT_EVENT_UPDATE_FAILED:${response.status}:${data.error?.message ?? "Graph API error"}`)
  }
  await prisma.externalCalendarConnection.update({ where: { id: connection.id }, data: { lastSyncAt: new Date(), status: "CONNECTED" } })
  return { id: eventId, provider: "OUTLOOK_CALENDAR" as const }
}

export async function deleteAdvisorOutlookCalendarEvent({
  organizationId,
  userId,
  eventId,
}: {
  organizationId: string
  userId: string
  eventId: string
}) {
  if (!isMicrosoftCalendarConfigured()) return false
  const connection = await prisma.externalCalendarConnection.findFirst({
    where: { organizationId, userId, provider: "OUTLOOK_CALENDAR", status: "CONNECTED", syncEnabled: true },
  })
  if (!connection) return false
  const accessToken = await getValidMicrosoftAccessToken(connection)
  const response = await fetch(`${graphCalendarEventsUrl}/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const data = await response.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(`MICROSOFT_EVENT_DELETE_FAILED:${response.status}:${data.error?.message ?? "Graph API error"}`)
  }
  await prisma.externalCalendarConnection.update({ where: { id: connection.id }, data: { lastSyncAt: new Date(), status: "CONNECTED" } })
  return true
}
