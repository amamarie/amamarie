import { createCrmActivity } from "@/lib/crm-events"
import { getAdvisorGoogleWorkspaceAccessToken } from "@/lib/google/gmail"
import { prisma } from "@/lib/prisma"
import { createOrQualifyLeadFromSource } from "@/lib/services/lead-intake-sources"

type GmailListResponse = {
  messages?: { id: string; threadId?: string }[]
  nextPageToken?: string
}

type GmailMessageResponse = {
  id: string
  threadId?: string
  snippet?: string
  payload?: {
    headers?: { name: string; value: string }[]
  }
  internalDate?: string
}

type SyncIncomingGmailInput = {
  organizationId: string
  userId: string
  maxResults?: number
  query?: string
}

function header(message: GmailMessageResponse, name: string) {
  return message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value ?? ""
}

function parseEmailAddress(value: string) {
  const match = value.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/)
  if (match) {
    return {
      name: match[1]?.trim() || null,
      email: match[2]?.trim().toLowerCase() || null,
    }
  }
  const email = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() ?? null
  const name = email ? value.replace(email, "").replace(/[<>()"]/g, "").trim() || null : null
  return { name, email }
}

function splitName(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split("@")[0]?.replace(/[._-]+/g, " ")
  const parts = source?.split(/\s+/).filter(Boolean) ?? []
  return {
    firstName: parts[0] ?? "Nouveau",
    lastName: parts.slice(1).join(" ") || "prospect",
  }
}

function messageDate(message: GmailMessageResponse) {
  const dateHeader = header(message, "Date")
  const parsedHeader = dateHeader ? new Date(dateHeader) : null
  if (parsedHeader && !Number.isNaN(parsedHeader.getTime())) return parsedHeader
  const internal = message.internalDate ? Number(message.internalDate) : NaN
  return Number.isFinite(internal) ? new Date(internal) : null
}

async function gmailFetch<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json().catch(() => ({})) as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(`GMAIL_SYNC_FAILED:${response.status}:${data.error?.message ?? "Gmail API error"}`)
  return data
}

export async function syncIncomingGmailLeads({ organizationId, userId, maxResults = 15, query }: SyncIncomingGmailInput) {
  const google = await getAdvisorGoogleWorkspaceAccessToken({ organizationId, userId })
  if (!google) throw new Error("GMAIL_NOT_CONNECTED")
  if (!google.scope.split(/\s+/).includes("https://www.googleapis.com/auth/gmail.readonly")) {
    throw new Error("GMAIL_READ_SCOPE_MISSING")
  }

  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages")
  listUrl.searchParams.set("maxResults", String(Math.min(Math.max(maxResults, 1), 50)))
  listUrl.searchParams.set("q", query?.trim() || "in:inbox newer_than:30d -from:me")

  const list = await gmailFetch<GmailListResponse>(listUrl.toString(), google.accessToken)
  const messages = list.messages ?? []
  const results = []

  for (const item of messages) {
    const alreadyImported = await prisma.activity.findFirst({
      where: {
        organizationId,
        entityType: "GmailMessage",
        entityId: item.id,
        type: "EMAIL_RECEIVED",
      },
      select: { id: true },
    })
    if (alreadyImported) {
      results.push({ messageId: item.id, skipped: true, reason: "already_imported" })
      continue
    }

    const messageUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}`)
    messageUrl.searchParams.set("format", "metadata")
    messageUrl.searchParams.set("metadataHeaders", "From")
    messageUrl.searchParams.append("metadataHeaders", "Subject")
    messageUrl.searchParams.append("metadataHeaders", "Date")

    const message = await gmailFetch<GmailMessageResponse>(messageUrl.toString(), google.accessToken)
    const from = parseEmailAddress(header(message, "From"))
    if (!from.email || from.email === google.email.toLowerCase()) {
      results.push({ messageId: item.id, skipped: true, reason: "sender_not_usable" })
      continue
    }

    const name = splitName(from.name, from.email)
    const subject = header(message, "Subject") || "Courriel entrant"
    const text = [`Sujet: ${subject}`, message.snippet ? `Aperçu: ${message.snippet}` : null].filter(Boolean).join("\n")

    const imported = await createOrQualifyLeadFromSource({
      organizationId,
      advisorId: userId,
      sourceKind: "EMAIL",
      firstName: name.firstName,
      lastName: name.lastName,
      email: from.email,
      message: text,
      interestType: "courriel entrant",
      externalId: message.id,
      externalType: "GmailMessage",
      metadata: {
        gmailMessageId: message.id,
        gmailThreadId: message.threadId,
        subject,
        from: header(message, "From"),
        receivedAt: messageDate(message)?.toISOString() ?? null,
      },
    })

    await createCrmActivity({
      organizationId,
      userId,
      leadId: imported.lead.id,
      type: "EMAIL_RECEIVED",
      title: "Courriel entrant importé",
      description: `${from.email}: ${subject}`,
      source: "IMPORT",
      entityType: "GmailMessage",
      entityId: message.id,
      metadata: {
        gmailMessageId: message.id,
        gmailThreadId: message.threadId,
        subject,
        snippet: message.snippet,
      },
    })

    results.push({ messageId: item.id, leadId: imported.lead.id, created: imported.created, skipped: false })
  }

  await prisma.gmailIntegrationConnection.updateMany({
    where: { organizationId, userId },
    data: { lastUsedAt: new Date() },
  })

  return {
    checked: messages.length,
    imported: results.filter((result) => !result.skipped).length,
    skipped: results.filter((result) => result.skipped).length,
    results,
  }
}
