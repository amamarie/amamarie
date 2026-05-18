import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getUnreadCount } from "@/lib/services/notifications"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId, userId } = await getTenantContext()
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, role: true },
    })
    const count = await getUnreadCount({ organizationId, user })

    return ok({ count })
  } catch (error) {
    return handleApiError(error)
  }
}
