import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { markAllNotificationsRead } from "@/lib/services/notifications"
import { getTenantContext } from "@/lib/tenant"

export async function PATCH() {
  try {
    const { organizationId, userId } = await getTenantContext()
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, role: true },
    })
    const result = await markAllNotificationsRead({ organizationId, user })

    return ok(result)
  } catch (error) {
    return handleApiError(error)
  }
}
