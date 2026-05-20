import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { findBestAdvisor } from "@/lib/calendar/routing"
import { prisma } from "@/lib/prisma"

const schema = z.object({
  organizationId: z.string().trim().min(1),
  meetingTypeId: z.string().trim().min(1).optional().nullable(),
  date: z.string().datetime().optional().nullable(),
  timezone: z.string().trim().min(1).default("America/Toronto"),
  specialty: z.string().trim().max(120).optional().nullable(),
  language: z.string().trim().max(80).optional().nullable(),
})

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json())
    const organization = await prisma.organization.findUnique({ where: { id: payload.organizationId }, select: { id: true } })
    if (!organization) return fail("NOT_FOUND", "Cabinet introuvable.", 404)
    const result = await findBestAdvisor({
      organizationId: payload.organizationId,
      meetingTypeId: payload.meetingTypeId,
      date: payload.date ? new Date(payload.date) : new Date(),
      timezone: payload.timezone,
      specialty: payload.specialty,
      language: payload.language,
    })
    return ok(result)
  } catch (error) {
    return handleApiError(error)
  }
}

