import crypto from "node:crypto"

import type { GmailIntegrationConnection } from "@prisma/client"

import { prisma } from "@/lib/prisma"

const gmailSendScope = "https://www.googleapis.com/auth/gmail.send"
const gmailReadonlyScope = "https://www.googleapis.com/auth/gmail.readonly"
const calendarEventsScope = "https://www.googleapis.com/auth/calendar.events"
const calendarReadonlyScope = "https://www.googleapis.com/auth/calendar.readonly"
const calendarFreeBusyScope = "https://www.googleapis.com/auth/calendar.freebusy"
const driveFileScope = "https://www.googleapis.com/auth/drive.file"
const spreadsheetsScope = "https://www.googleapis.com/auth/spreadsheets"
const userEmailScope = "https://www.googleapis.com/auth/userinfo.email"
const googleWorkspaceScopes = [
  gmailSendScope,
  gmailReadonlyScope,
  calendarEventsScope,
  calendarReadonlyScope,
  calendarFreeBusyScope,
  driveFileScope,
  spreadsheetsScope,
  userEmailScope,
]
const oauthTokenUrl = "https://oauth2.googleapis.com/token"
const oauthAuthorizeUrl = "https://accounts.google.com/o/oauth2/v2/auth"
const userInfoUrl = "https://www.googleapis.com/oauth2/v2/userinfo"

type GmailConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
  stateSecret: string
}

type GmailOAuthState = {
  organizationId: string
  userId: string
  returnTo: string
  issuedAt: number
}

type GoogleTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

type GoogleUserInfo = {
  email?: string
  verified_email?: boolean
}

export type SendGmailEmailInput = {
  organizationId: string
  userId: string
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
}

export type CreateGoogleCalendarEventInput = {
  organizationId: string
  userId: string
  summary: string
  description?: string
  start: Date
  end: Date
  attendeeEmail?: string | null
  timezone?: string | null
  createMeetLink?: boolean
}

export type GoogleCalendarBusyRange = {
  start: Date
  end: Date
}

export function isGoogleGmailConfigured() {
  return Boolean(resolveGoogleClientId() && resolveGoogleClientSecret())
}

function parseScopes(scope?: string | null) {
  return new Set((scope ?? "").split(/\s+/).filter(Boolean))
}

function missingGoogleWorkspaceScopes(scope?: string | null) {
  const granted = parseScopes(scope)
  return googleWorkspaceScopes.filter((requiredScope) => !granted.has(requiredScope))
}

export function googleGmailRedirectUri(request: Request) {
  const configured = process.env.GOOGLE_GMAIL_REDIRECT_URI?.trim()
  if (configured) return configured
  const origin = new URL(request.url).origin
  return `${origin}/api/integrations/google/gmail/callback`
}

function resolveGoogleClientId() {
  return process.env.GOOGLE_GMAIL_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim()
}

function resolveGoogleClientSecret() {
  return process.env.GOOGLE_GMAIL_CLIENT_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim()
}

function resolveStateSecret() {
  return process.env.GOOGLE_OAUTH_STATE_SECRET?.trim() || process.env.CLERK_SECRET_KEY?.trim()
}

function googleConfig(request: Request): GmailConfig {
  const clientId = resolveGoogleClientId()
  const clientSecret = resolveGoogleClientSecret()
  const stateSecret = resolveStateSecret()

  if (!clientId || !clientSecret || !stateSecret) {
    throw new Error("GOOGLE_GMAIL_NOT_CONFIGURED")
  }

  return {
    clientId,
    clientSecret,
    redirectUri: googleGmailRedirectUri(request),
    stateSecret,
  }
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

export function createGoogleGmailOAuthUrl({
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
  const config = googleConfig(request)
  const payload = base64UrlEncode(JSON.stringify({ organizationId, userId, returnTo, issuedAt: Date.now() } satisfies GmailOAuthState))
  const state = `${payload}.${signState(payload, config.stateSecret)}`
  const url = new URL(oauthAuthorizeUrl)
  url.searchParams.set("client_id", config.clientId)
  url.searchParams.set("redirect_uri", config.redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", googleWorkspaceScopes.join(" "))
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("include_granted_scopes", "true")
  url.searchParams.set("state", state)
  return url
}

export function verifyGoogleGmailOAuthState(request: Request, state: string | null): GmailOAuthState {
  if (!state) throw new Error("GOOGLE_OAUTH_INVALID_STATE")
  const config = googleConfig(request)
  const [payload, signature] = state.split(".")
  if (!payload || !signature) throw new Error("GOOGLE_OAUTH_INVALID_STATE")

  const expected = signState(payload, config.stateSecret)
  if (signature.length !== expected.length) throw new Error("GOOGLE_OAUTH_INVALID_STATE")
  const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  if (!valid) throw new Error("GOOGLE_OAUTH_INVALID_STATE")

  const parsed = JSON.parse(base64UrlDecode(payload)) as GmailOAuthState
  if (Date.now() - parsed.issuedAt > 10 * 60 * 1000) throw new Error("GOOGLE_OAUTH_STATE_EXPIRED")
  return parsed
}

async function exchangeCodeForTokens(request: Request, code: string) {
  const config = googleConfig(request)
  const response = await fetch(oauthTokenUrl, {
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
  const data = await response.json() as GoogleTokenResponse
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(`GOOGLE_TOKEN_EXCHANGE_FAILED:${data.error_description ?? data.error ?? response.status}`)
  }
  return data
}

async function getGoogleUserEmail(accessToken: string) {
  const response = await fetch(userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json() as GoogleUserInfo
  if (!response.ok || !data.email) throw new Error("GOOGLE_USERINFO_FAILED")
  return data.email
}

export async function saveGoogleGmailConnection({
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
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId }, select: { role: true } })
  if (user?.role === "DEVELOPER") throw new Error("GOOGLE_WORKSPACE_DEVELOPER_BLOCKED")
  const tokens = await exchangeCodeForTokens(request, code)
  const email = await getGoogleUserEmail(tokens.access_token!)
  const existing = await prisma.gmailIntegrationConnection.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  })
  const refreshToken = tokens.refresh_token ?? existing?.refreshToken
  if (!refreshToken) throw new Error("GOOGLE_REFRESH_TOKEN_MISSING")

  return prisma.gmailIntegrationConnection.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    create: {
      organizationId,
      userId,
      email,
      accessToken: tokens.access_token,
      refreshToken,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      expiresAt: expiresAtFromSeconds(tokens.expires_in),
      status: "CONNECTED",
      connectedAt: new Date(),
    },
    update: {
      email,
      accessToken: tokens.access_token,
      refreshToken,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      expiresAt: expiresAtFromSeconds(tokens.expires_in),
      status: "CONNECTED",
      connectedAt: new Date(),
    },
  })
    .then(async (connection) => {
      await prisma.externalCalendarConnection.deleteMany({
        where: { organizationId, userId, provider: "GOOGLE_CALENDAR" },
      })
      await prisma.externalCalendarConnection.create({
        data: {
          organizationId,
          userId,
          provider: "GOOGLE_CALENDAR",
          providerAccountEmail: email,
          accessTokenEncrypted: connection.accessToken,
          refreshTokenEncrypted: connection.refreshToken,
          syncEnabled: true,
          lastSyncAt: new Date(),
          status: "CONNECTED",
        },
      })
      return connection
    })
}

function expiresAtFromSeconds(seconds?: number) {
  if (!seconds) return null
  return new Date(Date.now() + seconds * 1000)
}

export async function getGmailConnectionStatus({ organizationId, userId }: { organizationId: string; userId: string }) {
  const connection = await prisma.gmailIntegrationConnection.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { email: true, status: true, scope: true, connectedAt: true, lastUsedAt: true },
  })
  const missingScopes = missingGoogleWorkspaceScopes(connection?.scope)
  return {
    connected: connection?.status === "CONNECTED",
    email: connection?.email ?? null,
    scopes: Array.from(parseScopes(connection?.scope)),
    missingScopes,
    hasWorkspaceScopes: connection?.status === "CONNECTED" && missingScopes.length === 0,
    connectedAt: connection?.connectedAt ?? null,
    lastUsedAt: connection?.lastUsedAt ?? null,
  }
}

export async function hasAdvisorGmailConnection({ organizationId, userId }: { organizationId: string; userId?: string | null }) {
  if (!userId || !isGoogleGmailConfigured()) return false
  const connection = await prisma.gmailIntegrationConnection.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { status: true },
  })
  return connection?.status === "CONNECTED"
}

export async function disconnectGoogleGmail({ organizationId, userId }: { organizationId: string; userId: string }) {
  await prisma.gmailIntegrationConnection.deleteMany({ where: { organizationId, userId } })
  await prisma.externalCalendarConnection.deleteMany({ where: { organizationId, userId, provider: "GOOGLE_CALENDAR" } })
}

async function refreshGoogleAccessToken(connection: GmailIntegrationConnection) {
  const clientId = resolveGoogleClientId()
  const clientSecret = resolveGoogleClientSecret()
  if (!clientId || !clientSecret) throw new Error("GOOGLE_GMAIL_NOT_CONFIGURED")

  const response = await fetch(oauthTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refreshToken,
      grant_type: "refresh_token",
    }),
  })
  const data = await response.json() as GoogleTokenResponse
  if (!response.ok || data.error || !data.access_token) {
    throw new Error(`GMAIL_TOKEN_REFRESH_FAILED:${data.error_description ?? data.error ?? response.status}`)
  }

  const updated = await prisma.gmailIntegrationConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: data.access_token,
      scope: data.scope ?? connection.scope,
      tokenType: data.token_type ?? connection.tokenType,
      expiresAt: expiresAtFromSeconds(data.expires_in),
      status: "CONNECTED",
    },
  })
  return updated.accessToken!
}

async function getValidGmailAccessToken(connection: GmailIntegrationConnection) {
  const expiresAt = connection.expiresAt?.getTime() ?? 0
  if (connection.accessToken && expiresAt > Date.now() + 60_000) {
    return connection.accessToken
  }
  return refreshGoogleAccessToken(connection)
}

export async function getAdvisorGoogleWorkspaceAccessToken({ organizationId, userId }: { organizationId: string; userId: string }) {
  if (!isGoogleGmailConfigured()) return null
  const connection = await prisma.gmailIntegrationConnection.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  })
  if (!connection || connection.status !== "CONNECTED") return null
  const accessToken = await getValidGmailAccessToken(connection)
  return {
    accessToken,
    email: connection.email,
    scope: connection.scope ?? "",
    hasWorkspaceScopes: missingGoogleWorkspaceScopes(connection.scope).length === 0,
  }
}

function mimeHeader(value: string) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`
}

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim()
}

function createRawEmail({
  from,
  to,
  replyTo,
  subject,
  text,
  html,
}: {
  from: string
  to: string
  replyTo?: string
  subject: string
  text: string
  html?: string
}) {
  const contentType = html ? "text/html" : "text/plain"
  const body = html ?? text
  const headers = [
    `To: ${sanitizeHeader(to)}`,
    `From: ${sanitizeHeader(from)}`,
    ...(replyTo ? [`Reply-To: ${sanitizeHeader(replyTo)}`] : []),
    `Subject: ${mimeHeader(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: ${contentType}; charset=UTF-8`,
    "Content-Transfer-Encoding: 8bit",
  ]
  return base64UrlEncode(`${headers.join("\r\n")}\r\n\r\n${body}`)
}

export async function sendAdvisorGmailEmail(input: SendGmailEmailInput) {
  if (!isGoogleGmailConfigured()) return null
  const connection = await prisma.gmailIntegrationConnection.findUnique({
    where: { organizationId_userId: { organizationId: input.organizationId, userId: input.userId } },
  })
  if (!connection || connection.status !== "CONNECTED") return null

  const accessToken = await getValidGmailAccessToken(connection)
  const raw = createRawEmail({
    from: connection.email,
    to: input.to,
    replyTo: input.replyTo ?? connection.email,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })

  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  })
  const data = await response.json().catch(() => ({})) as { id?: string; error?: { message?: string } }
  if (!response.ok) {
    throw new Error(`GMAIL_SEND_FAILED:${response.status}:${data.error?.message ?? "Gmail API error"}`)
  }

  await prisma.gmailIntegrationConnection.update({
    where: { id: connection.id },
    data: { lastUsedAt: new Date() },
  })

  return { id: data.id, from: connection.email, provider: "GMAIL" as const }
}

export async function createAdvisorGoogleCalendarEvent(input: CreateGoogleCalendarEventInput) {
  if (!isGoogleGmailConfigured()) return null
  const connection = await prisma.gmailIntegrationConnection.findUnique({
    where: { organizationId_userId: { organizationId: input.organizationId, userId: input.userId } },
  })
  if (!connection || connection.status !== "CONNECTED") return null
  if (!parseScopes(connection.scope).has(calendarEventsScope)) throw new Error("GOOGLE_CALENDAR_SCOPE_MISSING")

  const accessToken = await getValidGmailAccessToken(connection)
  const eventUrl = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events")
  if (input.createMeetLink) eventUrl.searchParams.set("conferenceDataVersion", "1")
  const response = await fetch(eventUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.start.toISOString(), timeZone: input.timezone ?? undefined },
      end: { dateTime: input.end.toISOString(), timeZone: input.timezone ?? undefined },
      attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
      conferenceData: input.createMeetLink ? {
        createRequest: {
          requestId: crypto.randomBytes(12).toString("hex"),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      } : undefined,
    }),
  })
  const data = await response.json().catch(() => ({})) as { id?: string; htmlLink?: string; hangoutLink?: string; error?: { message?: string } }
  if (!response.ok) throw new Error(`GOOGLE_CALENDAR_EVENT_FAILED:${response.status}:${data.error?.message ?? "Calendar API error"}`)

  await prisma.gmailIntegrationConnection.update({
    where: { id: connection.id },
    data: { lastUsedAt: new Date() },
  })

  return { id: data.id, url: data.htmlLink, meetingUrl: data.hangoutLink ?? data.htmlLink, provider: "GOOGLE_CALENDAR" as const }
}

export async function updateAdvisorGoogleCalendarEvent(input: CreateGoogleCalendarEventInput & { eventId: string }) {
  if (!isGoogleGmailConfigured()) return null
  const connection = await prisma.gmailIntegrationConnection.findUnique({
    where: { organizationId_userId: { organizationId: input.organizationId, userId: input.userId } },
  })
  if (!connection || connection.status !== "CONNECTED") return null
  if (!parseScopes(connection.scope).has(calendarEventsScope)) throw new Error("GOOGLE_CALENDAR_SCOPE_MISSING")

  const accessToken = await getValidGmailAccessToken(connection)
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(input.eventId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.start.toISOString(), timeZone: input.timezone ?? undefined },
      end: { dateTime: input.end.toISOString(), timeZone: input.timezone ?? undefined },
      attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
    }),
  })
  const data = await response.json().catch(() => ({})) as { id?: string; htmlLink?: string; hangoutLink?: string; error?: { message?: string } }
  if (!response.ok) throw new Error(`GOOGLE_CALENDAR_EVENT_UPDATE_FAILED:${response.status}:${data.error?.message ?? "Calendar API error"}`)
  await prisma.gmailIntegrationConnection.update({ where: { id: connection.id }, data: { lastUsedAt: new Date() } })
  return { id: data.id, url: data.htmlLink, meetingUrl: data.hangoutLink ?? data.htmlLink, provider: "GOOGLE_CALENDAR" as const }
}

export async function deleteAdvisorGoogleCalendarEvent({
  organizationId,
  userId,
  eventId,
}: {
  organizationId: string
  userId: string
  eventId: string
}) {
  if (!isGoogleGmailConfigured()) return false
  const connection = await prisma.gmailIntegrationConnection.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  })
  if (!connection || connection.status !== "CONNECTED") return false
  if (!parseScopes(connection.scope).has(calendarEventsScope)) return false
  const accessToken = await getValidGmailAccessToken(connection)
  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const data = await response.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(`GOOGLE_CALENDAR_EVENT_DELETE_FAILED:${response.status}:${data.error?.message ?? "Calendar API error"}`)
  }
  await prisma.gmailIntegrationConnection.update({ where: { id: connection.id }, data: { lastUsedAt: new Date() } })
  return true
}

export async function getAdvisorGoogleCalendarBusyRanges({
  organizationId,
  userId,
  start,
  end,
}: {
  organizationId: string
  userId: string
  start: Date
  end: Date
}): Promise<GoogleCalendarBusyRange[]> {
  if (!isGoogleGmailConfigured()) return []
  const connection = await prisma.gmailIntegrationConnection.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  })
  if (!connection || connection.status !== "CONNECTED") return []
  const scopes = parseScopes(connection.scope)
  if (!scopes.has(calendarFreeBusyScope) && !scopes.has(calendarReadonlyScope) && !scopes.has(calendarEventsScope)) return []

  const accessToken = await getValidGmailAccessToken(connection)
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      items: [{ id: "primary" }],
    }),
  })
  const data = await response.json().catch(() => ({})) as {
    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>
    error?: { message?: string }
  }
  if (!response.ok) throw new Error(`GOOGLE_CALENDAR_FREEBUSY_FAILED:${response.status}:${data.error?.message ?? "Calendar API error"}`)

  await prisma.gmailIntegrationConnection.update({
    where: { id: connection.id },
    data: { lastUsedAt: new Date() },
  })
  await prisma.externalCalendarConnection.updateMany({
    where: { organizationId, userId, provider: "GOOGLE_CALENDAR" },
    data: { lastSyncAt: new Date(), status: "CONNECTED" },
  })

  return Object.values(data.calendars ?? {}).flatMap((calendar) => (calendar.busy ?? []).map((range) => ({
    start: new Date(range.start),
    end: new Date(range.end),
  })))
}
