import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { markNotificationRead } from "@/lib/services/notifications"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const { organizationId, userId } = await getTenantContext()
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, role: true } })
    const notification = await markNotificationRead({ organizationId, user, id })

    return ok(notification)
  } catch (error) {
    if (error instanceof Error && error.message === "NOTIFICATION_NOT_FOUND") return fail("NOT_FOUND", "Notification introuvable.", 404)
    return handleApiError(error)
  }
}
