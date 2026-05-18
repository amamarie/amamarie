import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const communicationMessageSchema = z.object({
  id: z.string().min(1),
  channel: z.enum(["SMS", "EMAIL", "CALL"]),
})

const bulkDeleteSchema = z.object({
  messages: z.array(communicationMessageSchema).min(1).max(100),
})

export async function DELETE(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const payload = bulkDeleteSchema.parse(await request.json())

    const smsIds = payload.messages.filter((message) => message.channel === "SMS").map((message) => message.id)
    const callIds = payload.messages.filter((message) => message.channel === "CALL").map((message) => message.id)
    const emailActivityIds = payload.messages.filter((message) => message.channel === "EMAIL").map((message) => message.id)

    const [smsResult, callResult, emailResult] = await prisma.$transaction([
      prisma.sMSMessage.deleteMany({
        where: { organizationId, id: { in: smsIds } },
      }),
      prisma.callLog.deleteMany({
        where: { organizationId, id: { in: callIds } },
      }),
      prisma.activity.deleteMany({
        where: {
          organizationId,
          id: { in: emailActivityIds },
          type: { in: ["EMAIL_RECEIVED", "EMAIL_SENT"] },
        },
      }),
    ])

    const deletedCount = smsResult.count + callResult.count + emailResult.count
    if (deletedCount === 0) {
      return fail("NOT_FOUND", "Aucun message admissible n’a été trouvé.", 404)
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
