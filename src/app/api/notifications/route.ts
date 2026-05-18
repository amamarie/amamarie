import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { createNotification, getNotifications } from "@/lib/services/notifications"
import { getTenantContext } from "@/lib/tenant"

async function getCurrentNotificationUser(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, role: true },
  })
  return user
}

export async function GET(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const user = await getCurrentNotificationUser(userId)
    const params = Object.fromEntries(new URL(request.url).searchParams.entries())
    const notifications = await getNotifications({ organizationId, user, query: params })

    return ok(notifications)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const notification = await createNotification({
      ...(await request.json()),
      organizationId,
      userId,
    })

    return ok(notification, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
