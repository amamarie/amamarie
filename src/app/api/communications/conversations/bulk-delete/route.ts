import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const conversationEventSchema = z.object({
  id: z.string().min(1),
  channel: z.enum(["SMS", "EMAIL", "CALL"]),
})

const conversationDeleteSchema = z.object({
  key: z.string().min(1),
  type: z.enum(["CLIENT", "LEAD", "UNASSIGNED"]),
  clientId: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  events: z.array(conversationEventSchema).default([]),
})

const bulkDeleteSchema = z.object({
  conversations: z.array(conversationDeleteSchema).min(1).max(100),
})

function emptyWhere() {
  return { id: { in: [] as string[] } }
}

export async function DELETE(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const payload = bulkDeleteSchema.parse(await request.json())

    const clientIds = payload.conversations
      .map((conversation) => conversation.clientId)
      .filter((id): id is string => Boolean(id))
    const leadIds = payload.conversations
      .map((conversation) => conversation.leadId)
      .filter((id): id is string => Boolean(id))

    const fallbackEvents = payload.conversations
      .filter((conversation) => conversation.type === "UNASSIGNED")
      .flatMap((conversation) => conversation.events)

    const smsEventIds = fallbackEvents.filter((event) => event.channel === "SMS").map((event) => event.id)
    const callEventIds = fallbackEvents.filter((event) => event.channel === "CALL").map((event) => event.id)
    const emailEventIds = fallbackEvents.filter((event) => event.channel === "EMAIL").map((event) => event.id)

    const linkedOr = [
      clientIds.length > 0 ? { clientId: { in: clientIds } } : null,
      leadIds.length > 0 ? { leadId: { in: leadIds } } : null,
    ].filter(Boolean) as Array<{ clientId: { in: string[] } } | { leadId: { in: string[] } }>

    const [smsResult, callResult, emailResult] = await prisma.$transaction([
      prisma.sMSMessage.deleteMany({
        where: {
          organizationId,
          OR: [
            ...linkedOr,
            smsEventIds.length > 0 ? { id: { in: smsEventIds } } : emptyWhere(),
          ],
        },
      }),
      prisma.callLog.deleteMany({
        where: {
          organizationId,
          OR: [
            ...linkedOr,
            callEventIds.length > 0 ? { id: { in: callEventIds } } : emptyWhere(),
          ],
        },
      }),
      prisma.activity.deleteMany({
        where: {
          organizationId,
          type: { in: ["EMAIL_RECEIVED", "EMAIL_SENT"] },
          OR: [
            ...linkedOr,
            emailEventIds.length > 0 ? { id: { in: emailEventIds } } : emptyWhere(),
          ],
        },
      }),
    ])

    const deletedCount = smsResult.count + callResult.count + emailResult.count
    if (deletedCount === 0) {
      return fail("NOT_FOUND", "Aucune communication admissible n’a été trouvée.", 404)
    }

    return ok({
      deletedCount,
      smsDeleted: smsResult.count,
      callsDeleted: callResult.count,
      emailsDeleted: emailResult.count,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
