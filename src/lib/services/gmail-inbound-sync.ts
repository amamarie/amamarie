import { createCrmActivity } from "@/lib/crm-events"
import { getAdvisorGoogleWorkspaceAccessToken } from "@/lib/google/gmail"
import { prisma } from "@/lib/prisma"

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

function classifyEmail(subject: string, snippet?: string) {
  const text = `${subject} ${snippet ?? ""}`.toLowerCase()

  if (/(urgent|plainte|réclamation|reclamation|résiliation|resiliation|annuler|probl[eè]me|mise en demeure)/i.test(text)) {
    return {
      type: "URGENT",
      priority: "HIGH",
      summary: snippet || subject,
      recommendedAction: "Traiter en priorité et créer une tâche de suivi si nécessaire.",
    }
  }

  if (/(pi[eè]ce jointe|document|justificatif|relev[eé]|signature|sign[eé]|police|contrat|formulaire)/i.test(text)) {
    return {
      type: "DOCUMENT",
      priority: "MEDIUM",
      summary: snippet || subject,
      recommendedAction: "Vérifier la pièce reçue et l’ajouter au dossier CRM.",
    }
  }

  if (/(rendez-vous|rdv|disponible|disponibilit[eé]|cr[eé]neau|rencontre|appel|visio)/i.test(text)) {
    return {
      type: "RENDEZ_VOUS",
      priority: "MEDIUM",
      summary: snippet || subject,
      recommendedAction: "Proposer un créneau et créer ou mettre à jour le rendez-vous.",
    }
  }

  if (/(devis|soumission|proposition|tarif|prix|offre|bilan|information|infos)/i.test(text)) {
    return {
      type: "OPPORTUNITE",
      priority: "MEDIUM",
      summary: snippet || subject,
      recommendedAction: "Qualifier le besoin et créer une tâche ou une opportunité si pertinent.",
    }
  }

  return {
    type: "QUESTION",
    priority: "NORMAL",
    summary: snippet || subject,
    recommendedAction: "Lire le message, répondre si nécessaire, puis marquer comme traité.",
  }
}

async function findRelatedContact(organizationId: string, email: string) {
  const [client, lead] = await Promise.all([
    prisma.client.findFirst({
      where: {
        organizationId,
        status: { not: "ARCHIVED" },
        OR: [
          { email: { equals: email, mode: "insensitive" } },
          { emailPrimary: { equals: email, mode: "insensitive" } },
          { emailSecondary: { equals: email, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    }),
    prisma.lead.findFirst({
      where: {
        organizationId,
        status: { notIn: ["ARCHIVED", "LOST", "CONVERTED"] },
        email: { equals: email, mode: "insensitive" },
      },
      select: { id: true },
    }),
  ])

  return { clientId: client?.id ?? null, leadId: client ? null : lead?.id ?? null }
}

async function gmailFetch<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await response.json().catch(() => ({})) as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(`GMAIL_SYNC_FAILED:${response.status}:${data.error?.message ?? "Gmail API error"}`)
  return data
}

export async function syncIncomingGmailMessages({ organizationId, userId, maxResults = 15, query }: SyncIncomingGmailInput) {
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

    const subject = header(message, "Subject") || "Courriel entrant"
    const classification = classifyEmail(subject, message.snippet)
    const related = await findRelatedContact(organizationId, from.email)
    const senderName = parseEmailAddress(header(message, "From")).name ?? splitName(from.name, from.email).firstName

    await createCrmActivity({
      organizationId,
      userId,
      clientId: related.clientId,
      leadId: related.leadId,
      type: "EMAIL_RECEIVED",
      title: subject,
      description: `${from.email}: ${subject}`,
      source: "IMPORT",
      entityType: "GmailMessage",
      entityId: message.id,
      metadata: {
        gmailMessageId: message.id,
        gmailThreadId: message.threadId,
        subject,
        snippet: message.snippet,
        summary: classification.summary,
        recommendedAction: classification.recommendedAction,
        inboxStatus: "TO_PROCESS",
        inboxType: classification.type,
        priority: classification.priority,
        from: from.email,
        fromName: senderName,
        senderRaw: header(message, "From"),
        receivedAt: messageDate(message)?.toISOString() ?? null,
        linkedEntityType: related.clientId ? "CLIENT" : related.leadId ? "LEAD" : "UNASSIGNED",
      },
    })

    results.push({ messageId: item.id, clientId: related.clientId, leadId: related.leadId, type: classification.type, skipped: false })
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
