import { z } from "zod"

import { fail, handleApiError } from "@/lib/api-response"
import { findBestAdvisor } from "@/lib/calendar/routing"
import { POST as createAdvisorBooking } from "@/app/api/public/calendar/[advisorId]/book/route"

const publicBookingSchema = z.object({
  advisorSlug: z.string().trim().min(1).optional().nullable(),
  advisorId: z.string().trim().min(1).optional().nullable(),
  organizationId: z.string().trim().min(1).optional().nullable(),
  meetingTypeId: z.string().trim().min(1).optional().nullable(),
  start: z.string().datetime().optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  timezone: z.string().trim().min(1).default("America/Toronto"),
  service: z.string().trim().min(1).optional().nullable(),
  client: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.string().trim().email(),
    phone: z.string().trim().optional().nullable(),
  }).optional(),
  message: z.string().trim().max(1200).optional().nullable(),
  questionnaireAnswers: z.record(z.string(), z.unknown()).optional().default({}),
  marketingConsent: z.boolean().optional().default(false),
  meetingMode: z.enum(["VIDEO", "PHONE", "IN_PERSON"]).optional().default("VIDEO"),
})

export async function POST(request: Request) {
  try {
    const payload = publicBookingSchema.parse(await request.clone().json())
    const advisorKey = payload.advisorSlug ?? payload.advisorId
    let resolvedAdvisorKey = advisorKey

    if (!resolvedAdvisorKey) {
      if (!payload.organizationId) return fail("ADVISOR_REQUIRED", "advisorSlug, advisorId ou organizationId est requis.", 422)
      const requestedStart = payload.start ?? payload.startAt
      const routed = await findBestAdvisor({
        organizationId: payload.organizationId,
        meetingTypeId: payload.meetingTypeId,
        date: requestedStart ? new Date(requestedStart) : new Date(),
        timezone: payload.timezone,
      })
      if (!routed.selected) return fail("NO_ADVISOR_AVAILABLE", "Aucun conseiller disponible pour ce créneau.", 409)
      resolvedAdvisorKey = routed.selected.publicSlug
    }

    const clientName = payload.client ? `${payload.client.firstName} ${payload.client.lastName}`.trim() : undefined
    const body = {
      ...payload,
      name: clientName,
      email: payload.client?.email,
      phone: payload.client?.phone,
      service: payload.service ?? "Rendez-vous",
      startAt: payload.startAt ?? payload.start,
    }
    return createAdvisorBooking(new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ advisorId: resolvedAdvisorKey }) })
  } catch (error) {
    return handleApiError(error)
  }
}
