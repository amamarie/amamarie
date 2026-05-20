import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const advisorRoutingSchema = z.object({
  userId: z.string().min(1),
  specialties: z.string().max(1200).optional().nullable(),
  routingTerritories: z.string().max(800).optional().nullable(),
  routingLanguages: z.string().max(200).optional().nullable(),
  licenseNumber: z.string().max(120).optional().nullable(),
  routingPriority: z.coerce.number().int().min(0).max(100).optional(),
})

function clean(value?: string | null) {
  const next = value?.trim()
  return next ? next : null
}

export async function GET() {
  try {
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)

    const advisors = await prisma.user.findMany({
      where: {
        organizationId: user.organizationId,
        role: { in: ["OWNER", "ADVISOR"] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        title: true,
        phone: true,
        specialties: true,
        routingTerritories: true,
        routingLanguages: true,
        licenseNumber: true,
        routingPriority: true,
        advisorProfile: {
          select: {
            publicSlug: true,
            publicName: true,
            publicDescription: true,
            avatarUrl: true,
            bookingEnabled: true,
            defaultMeetingLocation: true,
            timezone: true,
          },
        },
        _count: {
          select: {
            leads: { where: { status: { notIn: ["CONVERTED", "LOST", "ARCHIVED"] } } },
            assignedTasks: { where: { status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] } } },
            availabilitySlots: { where: { isActive: true } },
          },
        },
        availabilitySlots: {
          where: { isActive: true },
          orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }],
          select: {
            id: true,
            advisorId: true,
            dayOfWeek: true,
            startMinutes: true,
            endMinutes: true,
            label: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    })

    return ok(advisors)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    if (!["OWNER", "DEVELOPER"].includes(user.role)) {
      return fail("FORBIDDEN", "Seul un administrateur peut modifier les règles de routage de l’équipe.", 403)
    }

    const payload = advisorRoutingSchema.parse(await request.json())
    const advisor = await prisma.user.findFirst({
      where: {
        id: payload.userId,
        organizationId: user.organizationId,
        role: { in: ["OWNER", "ADVISOR"] },
      },
      select: { id: true },
    })
    if (!advisor) return fail("NOT_FOUND", "Conseiller introuvable.", 404)

    const updated = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        specialties: clean(payload.specialties),
        routingTerritories: clean(payload.routingTerritories),
        routingLanguages: clean(payload.routingLanguages),
        licenseNumber: clean(payload.licenseNumber),
        routingPriority: payload.routingPriority ?? 50,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        title: true,
        phone: true,
        specialties: true,
        routingTerritories: true,
        routingLanguages: true,
        licenseNumber: true,
        routingPriority: true,
      },
    })

    return ok(updated)
  } catch (error) {
    return handleApiError(error)
  }
}
