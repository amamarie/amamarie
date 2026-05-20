import { handleApiError, ok } from "@/lib/api-response"
import { prepareMeeting } from "@/lib/ai/services/prepareMeeting"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const { id } = await params
    const booking = await prisma.booking.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        clientId: true,
        leadId: true,
        clientName: true,
        message: true,
        questionnaireAnswers: true,
        meetingTypeId: true,
        startAt: true,
      },
    })
    if (!booking) throw new Error("ENTITY_NOT_FOUND")
    const meetingType = booking.meetingTypeId ? await prisma.meetingType.findFirst({
      where: { id: booking.meetingTypeId, organizationId },
      select: { name: true },
    }) : null
    const data = await prepareMeeting({
      organizationId,
      userId,
      clientId: booking.clientId ?? undefined,
      leadId: booking.leadId ?? undefined,
      meetingContext: [
        `Réservation: ${meetingType?.name ?? "Rendez-vous"} avec ${booking.clientName}`,
        `Date: ${booking.startAt.toISOString()}`,
        booking.message ? `Message client: ${booking.message}` : null,
        booking.questionnaireAnswers ? `Questionnaire: ${JSON.stringify(booking.questionnaireAnswers)}` : null,
      ].filter(Boolean).join("\n"),
    })
    return ok(data)
  } catch (error) {
    return handleApiError(error)
  }
}
