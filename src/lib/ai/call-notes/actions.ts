import type { Priority, UserRole } from "@prisma/client"

import { createNote } from "@/lib/services/notes"
import { createTask } from "@/lib/services/tasks"

import type { CallNoteOutput } from "./schemas"

function taskPriority(priority: CallNoteOutput["priority"]): Priority {
  if (priority === "URGENT") return "URGENT"
  if (priority === "HIGH") return "HIGH"
  if (priority === "LOW") return "LOW"
  return "NORMAL"
}

function dueDateFromDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

export function formatCallNoteContent(note: CallNoteOutput) {
  const section = (title: string, items: string[]) => items.length ? `\n\n${title}:\n${items.map((item) => `- ${item}`).join("\n")}` : ""
  return [
    `Résumé:\n${note.summary}`,
    section("Besoins", note.needs),
    section("Contexte", note.context),
    section("Objections", note.objections),
    section("Prochaines étapes", note.nextSteps),
    note.followUpDate ? `\n\nSuivi suggéré: ${note.followUpDate}` : "",
    `\n\n${note.disclaimer}`,
  ].join("")
}

export async function saveGeneratedCallNote({
  organizationId,
  userId,
  userRole,
  clientId,
  leadId,
  note,
}: {
  organizationId: string
  userId: string
  userRole: UserRole
  clientId?: string
  leadId?: string
  note: CallNoteOutput
}) {
  const createdNote = await createNote({
    user: { id: userId, organizationId, role: userRole },
    data: {
      clientId,
      leadId,
      title: "Note d’appel générée par IA",
      content: formatCallNoteContent(note),
      type: "CALL",
      visibility: "TEAM",
      status: "ACTIVE",
      isPinned: false,
      isSensitive: false,
    },
  })

  const tasks = await Promise.all(
    note.tasks.map((task) =>
      createTask({
        organizationId,
        userId,
        data: {
          clientId,
          leadId,
          title: task.title,
          description: `Tâche suggérée depuis une note d’appel IA. Validation humaine effectuée.`,
          priority: taskPriority(task.priority),
          dueDate: dueDateFromDays(task.dueInDays),
          status: "TODO",
          type: "FOLLOW_UP",
        },
      })
    )
  )

  return { note: createdNote, tasks }
}
