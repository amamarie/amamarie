import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { deleteNotification, markNotificationRead } from "@/lib/services/notifications"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = {
  params: Promise<{ id: string }>
}

async function getCurrentNotificationUser(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, role: true },
  })
}

export async function PATCH(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const user = await getCurrentNotificationUser(userId)
    const notification = await markNotificationRead({ organizationId, user, id })

    return ok(notification)
  } catch (error) {
    if (error instanceof Error && error.message === "NOTIFICATION_NOT_FOUND") return fail("NOT_FOUND", "Notification introuvable.", 404)
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const user = await getCurrentNotificationUser(userId)
    const notification = await deleteNotification({ organizationId, user, id })

    return ok(notification)
  } catch (error) {
    if (error instanceof Error && error.message === "NOTIFICATION_NOT_FOUND") return fail("NOT_FOUND", "Notification introuvable.", 404)
    return handleApiError(error)
  }
}
