import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const permissionSchema = z.object({
  targetUserId: z.string().trim().min(1),
  permissionLevel: z.enum(["NONE", "FREE_BUSY_ONLY", "LIMITED_DETAILS", "VIEW_DETAILS", "EDIT_EVENTS", "ADMIN"]),
})

function canManageCalendarPermissions(role: string) {
  return ["OWNER", "ADVISOR", "ASSISTANT"].includes(role)
}

export async function GET() {
  try {
    const { organizationId, userId } = await getTenantContext()
    const permissions = await prisma.calendarPermission.findMany({
      where: { organizationId, targetUserId: userId },
      orderBy: { createdAt: "desc" },
    })
    return ok(permissions.map((permission) => ({
      ...permission,
      targetUserId: permission.viewerUserId,
    })))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request) {
  try {
    const { organizationId, userId, role } = await getTenantContext()
    if (!canManageCalendarPermissions(role)) return fail("FORBIDDEN", "Permission insuffisante.", 403)
    const payload = permissionSchema.parse(await request.json())
    if (payload.targetUserId === userId) return fail("VALIDATION_ERROR", "Vous voyez déjà votre propre calendrier.", 422)

    const target = await prisma.user.findFirst({
      where: { id: payload.targetUserId, organizationId },
      select: { id: true },
    })
    if (!target) return fail("NOT_FOUND", "Conseiller introuvable.", 404)

    await prisma.calendarPermission.deleteMany({
      where: { organizationId, viewerUserId: payload.targetUserId, targetUserId: userId },
    })

    if (payload.permissionLevel === "NONE") return ok({ permissionLevel: "NONE" })

    const permission = await prisma.calendarPermission.create({
      data: {
        organizationId,
        viewerUserId: payload.targetUserId,
        targetUserId: userId,
        permissionLevel: payload.permissionLevel,
      },
    })
    return ok({ ...permission, targetUserId: permission.viewerUserId })
  } catch (error) {
    return handleApiError(error)
  }
}
