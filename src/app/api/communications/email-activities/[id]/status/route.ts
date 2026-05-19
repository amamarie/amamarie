import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = {
  params: Promise<{ id: string }>
}

const statusSchema = z.object({
  status: z.enum(["TO_PROCESS", "WAITING", "PLANNED", "ANSWERED", "CLASSIFIED", "DONE", "ARCHIVED"]),
})

function activityMetadata(metadata: unknown) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {}
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = statusSchema.parse(await request.json())

    const activity = await prisma.activity.findFirst({
      where: { id, organizationId, type: "EMAIL_RECEIVED" },
      select: { id: true, clientId: true, leadId: true, title: true, metadata: true },
    })

    if (!activity) return fail("NOT_FOUND", "Courriel introuvable.", 404)

    const metadata = activityMetadata(activity.metadata)
    const processedAt = typeof metadata.processedAt === "string" ? metadata.processedAt : null
    const updated = await prisma.activity.update({
      where: { id: activity.id },
      data: {
        metadata: {
          ...metadata,
          inboxStatus: payload.status,
          processedAt: ["DONE", "ARCHIVED", "ANSWERED", "CLASSIFIED"].includes(payload.status) ? new Date().toISOString() : processedAt,
          processedByUserId: userId,
        },
      },
    })

    return ok({ item: updated })
  } catch (error) {
    return handleApiError(error)
  }
}
