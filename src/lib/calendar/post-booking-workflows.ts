import { prepareMeeting } from "@/lib/ai/services/prepareMeeting"
import { prisma } from "@/lib/prisma"

export async function runPostBookingWorkflow({
  organizationId,
  advisorId,
  bookingId,
  calendarEventId,
  taskId,
  clientId,
  leadId,
  service,
  startAt,
  endAt,
  clientName,
  questionnaireAnswers,
}: {
  organizationId: string
  advisorId: string
  bookingId?: string | null
  calendarEventId?: string | null
  taskId?: string | null
  clientId?: string | null
  leadId?: string | null
  service: string
  startAt?: Date | null
  endAt?: Date | null
  clientName: string
  questionnaireAnswers?: Record<string, unknown>
}) {
  if (!startAt || !endAt) return { preparationTaskId: null, followUpTaskId: null, aiPrepared: false }

  const preparationDue = new Date(Math.max(Date.now(), startAt.getTime() - 24 * 60 * 60 * 1000))
  const followUpDue = new Date(endAt.getTime() + 2 * 60 * 60 * 1000)
  const answers = questionnaireAnswers && Object.keys(questionnaireAnswers).length
    ? `\n\nQuestionnaire:\n${Object.entries(questionnaireAnswers).map(([key, value]) => `- ${key}: ${String(value)}`).join("\n")}`
    : ""

  const [preparationTask, followUpTask] = await prisma.$transaction([
    prisma.task.create({
      data: {
        organizationId,
        assignedToId: advisorId,
        createdById: advisorId,
        clientId: clientId ?? undefined,
        leadId: leadId ?? undefined,
        type: "FOLLOW_UP",
        priority: "HIGH",
        status: "TODO",
        startDate: preparationDue,
        dueDate: preparationDue,
        title: `Préparer le RDV - ${service}`,
        description: [
          `Préparer la rencontre avec ${clientName}.`,
          taskId ? `Tâche RDV: ${taskId}` : null,
          bookingId ? `Réservation: ${bookingId}` : null,
          calendarEventId ? `Événement calendrier: ${calendarEventId}` : null,
          answers,
        ].filter(Boolean).join("\n"),
        isAutomated: true,
      },
      select: { id: true },
    }),
    prisma.task.create({
      data: {
        organizationId,
        assignedToId: advisorId,
        createdById: advisorId,
        clientId: clientId ?? undefined,
        leadId: leadId ?? undefined,
        type: "FOLLOW_UP",
        priority: "NORMAL",
        status: "TODO",
        startDate: followUpDue,
        dueDate: followUpDue,
        title: `Suivi post-RDV - ${service}`,
        description: [
          `Envoyer le résumé, documents ou prochaines étapes à ${clientName}.`,
          taskId ? `Tâche RDV: ${taskId}` : null,
          bookingId ? `Réservation: ${bookingId}` : null,
        ].filter(Boolean).join("\n"),
        isAutomated: true,
      },
      select: { id: true },
    }),
  ])

  let aiPrepared = false
  if (clientId || leadId) {
    try {
      const preparation = await prepareMeeting({
        organizationId,
        userId: advisorId,
        clientId: clientId ?? undefined,
        leadId: leadId ?? undefined,
        meetingContext: `Rendez-vous ${service} prévu le ${startAt.toISOString()} avec ${clientName}.${answers}`,
      })
      await prisma.activity.create({
        data: {
          organizationId,
          userId: advisorId,
          clientId: clientId ?? undefined,
          leadId: leadId ?? undefined,
          taskId: preparationTask.id,
          type: "AI_CALL_NOTE_GENERATED",
          title: "Préparation IA du rendez-vous",
          description: JSON.stringify(preparation).slice(0, 4000),
          source: "AI",
          entityType: "Booking",
          entityId: bookingId ?? taskId ?? preparationTask.id,
        },
      })
      aiPrepared = true
    } catch {
      aiPrepared = false
    }
  }

  return { preparationTaskId: preparationTask.id, followUpTaskId: followUpTask.id, aiPrepared }
}
