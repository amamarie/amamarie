import { z } from "zod"

import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startMinutes: z.number().int().min(0).max(24 * 60 - 1),
  endMinutes: z.number().int().min(1).max(24 * 60),
  label: z.string().trim().max(80).optional().nullable(),
  isActive: z.boolean().default(true),
}).refine((slot) => slot.endMinutes > slot.startMinutes, {
  message: "L'heure de fin doit être après l'heure de début.",
  path: ["endMinutes"],
})

const availabilitySchema = z.object({
  slots: z.array(slotSchema).max(80),
})

export async function GET() {
  try {
    const { organizationId, userId } = await getTenantContext()
    const slots = await prisma.advisorAvailabilitySlot.findMany({
      where: { organizationId, advisorId: userId, isActive: true },
      orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }],
    })

    return ok(slots)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = availabilitySchema.parse(await request.json())

    const slots = await prisma.$transaction(async (tx) => {
      await tx.advisorAvailabilitySlot.deleteMany({
        where: { organizationId, advisorId: userId },
      })

      if (payload.slots.length > 0) {
        await tx.advisorAvailabilitySlot.createMany({
          data: payload.slots.map((slot) => ({
            organizationId,
            advisorId: userId,
            dayOfWeek: slot.dayOfWeek,
            startMinutes: slot.startMinutes,
            endMinutes: slot.endMinutes,
            label: slot.label?.trim() || null,
            isActive: slot.isActive,
          })),
          skipDuplicates: true,
        })
      }

      return tx.advisorAvailabilitySlot.findMany({
        where: { organizationId, advisorId: userId, isActive: true },
        orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }],
      })
    })

    return ok(slots)
  } catch (error) {
    return handleApiError(error)
  }
}
