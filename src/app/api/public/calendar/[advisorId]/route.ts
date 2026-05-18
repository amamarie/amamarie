import { fail, handleApiError, ok } from "@/lib/api-response"
import { getPublicCalendarData } from "@/lib/calendar/public-calendar"

export async function GET(_request: Request, { params }: { params: Promise<{ advisorId: string }> }) {
  try {
    const { advisorId } = await params
    const data = await getPublicCalendarData(advisorId)
    if (!data) return fail("NOT_FOUND", "Ce calendrier n’est pas disponible.", 404)
    return ok(data)
  } catch (error) {
    return handleApiError(error)
  }
}
