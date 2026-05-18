import type { Activity, CallLog, Client, Lead, SMSMessage } from "@prisma/client"

import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RelatedClient = Pick<Client, "id" | "firstName" | "lastName" | "email" | "emailPrimary" | "phone" | "phonePrimary">
type RelatedLead = Pick<Lead, "id" | "firstName" | "lastName" | "email" | "phone">

type TimelineEvent = {
  id: string
  channel: "SMS" | "EMAIL" | "CALL"
  direction: string
  status: string
  title: string
  body: string | null
  from: string | null
  to: string | null
  createdAt: Date
  href: string
}

type ConversationDraft = {
  key: string
  type: "CLIENT" | "LEAD" | "UNASSIGNED"
  name: string
  client: RelatedClient | null
  lead: RelatedLead | null
  phone: string | null
  email: string | null
  events: TimelineEvent[]
}

function personName(client?: RelatedClient | null, lead?: RelatedLead | null) {
  if (client) return `${client.firstName} ${client.lastName}`.trim()
  if (lead) return `${lead.firstName} ${lead.lastName}`.trim()
  return ""
}

function contactPhone(client?: RelatedClient | null, lead?: RelatedLead | null, fallback?: string | null) {
  return client?.phonePrimary || client?.phone || lead?.phone || fallback || null
}

function contactEmail(client?: RelatedClient | null, lead?: RelatedLead | null, fallback?: string | null) {
  return client?.emailPrimary || client?.email || lead?.email || fallback || null
}

function conversationKey(input: { client?: RelatedClient | null; lead?: RelatedLead | null; phone?: string | null; email?: string | null }) {
  if (input.client) return `client:${input.client.id}`
  if (input.lead) return `lead:${input.lead.id}`
  return `unassigned:${input.phone || input.email || "unknown"}`
}

function getConversation(map: Map<string, ConversationDraft>, input: { client?: RelatedClient | null; lead?: RelatedLead | null; phone?: string | null; email?: string | null }) {
  const key = conversationKey(input)
  const existing = map.get(key)
  if (existing) return existing

  const type = input.client ? "CLIENT" : input.lead ? "LEAD" : "UNASSIGNED"
  const name = personName(input.client, input.lead) || input.phone || input.email || "Non associé"
  const conversation: ConversationDraft = {
    key,
    type,
    name,
    client: input.client ?? null,
    lead: input.lead ?? null,
    phone: contactPhone(input.client, input.lead, input.phone),
    email: contactEmail(input.client, input.lead, input.email),
    events: [],
  }
  map.set(key, conversation)
  return conversation
}

function activityMetadata(activity: Pick<Activity, "metadata">) {
  return activity.metadata && typeof activity.metadata === "object" && !Array.isArray(activity.metadata)
    ? activity.metadata as Record<string, unknown>
    : {}
}

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit") ?? 150), 25), 250)
    const emailTypes = ["EMAIL_SENT", "EMAIL_RECEIVED"] as const

    const [smsMessages, calls, emailActivities] = await Promise.all([
      prisma.sMSMessage.findMany({
        where: { organizationId },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, email: true, emailPrimary: true, phone: true, phonePrimary: true } },
          lead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.callLog.findMany({
        where: { organizationId },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, email: true, emailPrimary: true, phone: true, phonePrimary: true } },
          lead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.activity.findMany({
        where: { organizationId, type: { in: [...emailTypes] } },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, email: true, emailPrimary: true, phone: true, phonePrimary: true } },
          lead: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ])

    const conversations = new Map<string, ConversationDraft>()

    for (const sms of smsMessages as Array<SMSMessage & { client: RelatedClient | null; lead: RelatedLead | null }>) {
      const fallbackPhone = sms.direction === "INBOUND" ? sms.fromNumber : sms.toNumber
      const conversation = getConversation(conversations, { client: sms.client, lead: sms.lead, phone: fallbackPhone })
      conversation.events.push({
        id: sms.id,
        channel: "SMS",
        direction: sms.direction,
        status: sms.status,
        title: sms.direction === "INBOUND" ? "SMS reçu" : "SMS envoyé",
        body: sms.body,
        from: sms.fromNumber,
        to: sms.toNumber,
        createdAt: sms.createdAt,
        href: sms.clientId ? `/clients/${sms.clientId}` : sms.leadId ? `/prospects/${sms.leadId}` : "/communications",
      })
    }

    for (const call of calls as Array<CallLog & { client: RelatedClient | null; lead: RelatedLead | null }>) {
      const fallbackPhone = call.direction === "INBOUND" ? call.fromNumber : call.toNumber
      const conversation = getConversation(conversations, { client: call.client, lead: call.lead, phone: fallbackPhone })
      conversation.events.push({
        id: call.id,
        channel: "CALL",
        direction: call.direction,
        status: call.status,
        title: call.direction === "INBOUND" ? "Appel reçu" : "Appel sortant",
        body: call.notes,
        from: call.fromNumber,
        to: call.toNumber,
        createdAt: call.createdAt,
        href: call.clientId ? `/clients/${call.clientId}` : call.leadId ? `/prospects/${call.leadId}` : "/communications",
      })
    }

    for (const activity of emailActivities) {
      const metadata = activityMetadata(activity)
      const fallbackEmail = String(metadata.to ?? metadata.from ?? metadata.email ?? "")
      const conversation = getConversation(conversations, { client: activity.client, lead: activity.lead, email: fallbackEmail || null })
      conversation.events.push({
        id: activity.id,
        channel: "EMAIL",
        direction: activity.type === "EMAIL_RECEIVED" ? "INBOUND" : "OUTBOUND",
        status: "RECORDED",
        title: activity.title,
        body: activity.description,
        from: typeof metadata.from === "string" ? metadata.from : null,
        to: typeof metadata.to === "string" ? metadata.to : null,
        createdAt: activity.createdAt,
        href: activity.clientId ? `/clients/${activity.clientId}` : activity.leadId ? `/prospects/${activity.leadId}` : "/communications",
      })
    }

    const data = Array.from(conversations.values())
      .map((conversation) => {
        const events = conversation.events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        const unreadCount = events.filter((event) =>
          event.direction === "INBOUND" && (event.channel === "SMS" || event.channel === "EMAIL")
        ).length
        const attentionCount = events.filter((event) =>
          ["FAILED", "UNDELIVERED", "MISSED", "NO_ANSWER"].includes(event.status)
        ).length
        return {
          ...conversation,
          events,
          latestAt: events[0]?.createdAt ?? null,
          latestPreview: events[0]?.body || events[0]?.title || "",
          unreadCount,
          attentionCount,
          href: conversation.client ? `/clients/${conversation.client.id}` : conversation.lead ? `/prospects/${conversation.lead.id}` : "/communications",
        }
      })
      .sort((a, b) => new Date(b.latestAt ?? 0).getTime() - new Date(a.latestAt ?? 0).getTime())

    return ok({ items: data })
  } catch (error) {
    return handleApiError(error)
  }
}
