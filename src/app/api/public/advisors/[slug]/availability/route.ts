import { fail, handleApiError, ok } from "@/lib/api-response"
import { resolvePublicAdvisor } from "@/lib/calendar/public-advisors"
import { getServerAvailableSlots } from "@/lib/calendar/server-availability"

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const url = new URL(request.url)
    const dateParam = url.searchParams.get("date")
    const meetingTypeId = url.searchParams.get("meetingTypeId")
    const timezone = url.searchParams.get("timezone") || "UTC"
    const day = dateParam ? new Date(`${dateParam}T00:00:00`) : new Date()
    if (Number.isNaN(day.getTime())) return fail("INVALID_DATE", "Date invalide.", 422)

    const advisor = await resolvePublicAdvisor(slug)
    if (!advisor) return fail("NOT_FOUND", "Conseiller introuvable ou réservation désactivée.", 404)

    const availability = await getServerAvailableSlots({
      organizationId: advisor.organizationId,
      advisorId: advisor.id,
      date: day,
      meetingTypeId,
      timezone,
    })

    return ok({
      date: dateParam ?? day.toISOString().slice(0, 10),
      timezone,
      durationMinutes: availability.rules.durationMinutes,
      slots: availability.slots,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

