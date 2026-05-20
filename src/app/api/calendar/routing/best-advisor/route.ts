import { z } from "zod"

import { handleApiError, ok } from "@/lib/api-response"
import { findBestAdvisor } from "@/lib/calendar/routing"
import { getTenantContext } from "@/lib/tenant"

const schema = z.object({
  meetingTypeId: z.string().trim().min(1).optional().nullable(),
  date: z.string().datetime().optional().nullable(),
  timezone: z.string().trim().min(1).default("America/Toronto"),
  specialty: z.string().trim().max(120).optional().nullable(),
  language: z.string().trim().max(80).optional().nullable(),
})

export async function POST(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const payload = schema.parse(await request.json())
    return ok(await findBestAdvisor({
      organizationId,
      meetingTypeId: payload.meetingTypeId,
      date: payload.date ? new Date(payload.date) : new Date(),
      timezone: payload.timezone,
      specialty: payload.specialty,
      language: payload.language,
    }))
  } catch (error) {
    return handleApiError(error)
  }
}

