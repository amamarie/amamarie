import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { dismissNotification } from "@/lib/services/notifications"
import { getTenantContext } from "@/lib/tenant"
import { dismissNotificationSchema } from "@/lib/validations/notification"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const { organizationId, userId } = await getTenantContext()
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, role: true } })
    const payload = dismissNotificationSchema.parse(await request.json().catch(() => ({})))
    const notification = await dismissNotification({ organizationId, user, id, reason: payload.reason })

    return ok(notification)
  } catch (error) {
    if (error instanceof Error && error.message === "NOTIFICATION_NOT_FOUND") return fail("NOT_FOUND", "Notification introuvable.", 404)
    return handleApiError(error)
  }
}
