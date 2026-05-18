import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"

import { aiAlertActionSchema } from "./schemas"

function taskPriority(priority: string) {
  if (priority === "CRITICAL") return "URGENT"
  if (priority === "HIGH") return "HIGH"
  if (priority === "MEDIUM") return "NORMAL"
  return "LOW"
}

function dueDateForPriority(priority: string) {
  const days = priority === "CRITICAL" ? 0 : priority === "HIGH" ? 3 : priority === "MEDIUM" ? 7 : 14
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

async function getLatestExplanation(organizationId: string, alertId: string) {
  const explanation = await prisma.alertAiExplanation.findFirst({
    where: { organizationId, alertId, status: { in: ["GENERATED", "REVIEWED"] } },
    include: { alert: true },
    orderBy: { createdAt: "desc" },
  })

  if (!explanation) {
    throw new Error("AI_EXPLANATION_NOT_FOUND")
  }

  return explanation
}

export async function getLatestAlertAiExplanation({
  organizationId,
  alertId,
}: {
  organizationId: string
  alertId: string
}) {
  return getLatestExplanation(organizationId, alertId)
}

export async function markAlertAiExplanationReviewed({
  organizationId,
  alertId,
  userId,
}: {
  organizationId: string
  alertId: string
  userId: string
}) {
  const explanation = await getLatestExplanation(organizationId, alertId)
  const updated = await prisma.alertAiExplanation.update({
    where: { id: explanation.id },
    data: { status: "REVIEWED", reviewedAt: new Date() },
  })

  await createCrmActivity({
    organizationId,
    userId,
    clientId: explanation.clientId,
    type: "AI_ALERT_EXPLANATION_REVIEWED",
    title: "Explication IA revue",
    description: explanation.summary,
  })

  return updated
}

export async function createTaskFromAlertAiExplanation({
  organizationId,
  alertId,
  userId,
  actionIndex = 0,
}: {
  organizationId: string
  alertId: string
  userId: string
  actionIndex?: number
}) {
  const explanation = await getLatestExplanation(organizationId, alertId)
  if (!explanation.clientId) throw new Error("CLIENT_REQUIRED")

  const actions = Array.isArray(explanation.suggestedActions) ? explanation.suggestedActions : []
  const parsedAction = aiAlertActionSchema.safeParse(actions[actionIndex])
  const action = parsedAction.success
    ? parsedAction.data
    : { label: explanation.summary, type: "CREATE_TASK" as const, priority: "MEDIUM" as const }

  const task = await prisma.task.create({
    data: {
      organizationId,
      clientId: explanation.clientId,
      assignedToId: userId,
      title: action.label,
      description: `${explanation.whyItTriggered}\n\n${explanation.riskLevelExplanation ?? ""}`.trim(),
      priority: taskPriority(action.priority),
      dueDate: dueDateForPriority(action.priority),
    },
  })

  await createCrmActivity({
    organizationId,
    userId,
    clientId: explanation.clientId,
    type: "AI_ALERT_TASK_CREATED",
    title: "Tâche créée depuis une explication IA",
    description: task.title,
  })

  return task
}

export async function createNoteFromAlertAiExplanation({
  organizationId,
  alertId,
  userId,
}: {
  organizationId: string
  alertId: string
  userId: string
}) {
  const explanation = await getLatestExplanation(organizationId, alertId)
  if (!explanation.clientId) throw new Error("CLIENT_REQUIRED")

  const note = await prisma.note.create({
    data: {
      organizationId,
      userId,
      clientId: explanation.clientId,
      title: "Note interne générée à partir d’une alerte",
      content: explanation.advisorNoteDraft ?? explanation.summary,
    },
  })

  await createCrmActivity({
    organizationId,
    userId,
    clientId: explanation.clientId,
    type: "AI_ALERT_NOTE_CREATED",
    title: "Note créée depuis une explication IA",
    description: explanation.summary,
  })

  return note
}
