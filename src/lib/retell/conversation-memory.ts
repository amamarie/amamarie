import { prisma } from "@/lib/prisma"
import { normalizePhoneNumber } from "@/lib/twilio/phone"

function compactLine(value?: string | null, max = 240) {
  return value?.replace(/\s+/g, " ").trim().slice(0, max) || null
}

function summaryText(value: unknown) {
  if (!value) return null
  if (typeof value === "string") return compactLine(value)
  if (typeof value === "object" && "text" in value) {
    return compactLine(String((value as { text?: unknown }).text ?? ""))
  }
  return compactLine(JSON.stringify(value))
}

export async function buildRetellConversationMemory({
  organizationId,
  leadId,
  clientId,
  phoneNumber,
}: {
  organizationId: string
  leadId?: string | null
  clientId?: string | null
  phoneNumber?: string | null
}) {
  const phone = normalizePhoneNumber(phoneNumber)
  const where = {
    organizationId,
    OR: [
      ...(leadId ? [{ leadId }] : []),
      ...(clientId ? [{ clientId }] : []),
      ...(phone ? [{ phoneNumber: phone }, { fromNumber: phone }, { toNumber: phone }] : []),
    ],
  }
  if (where.OR.length === 0) {
    return {
      conversation_memory: "",
      previous_topics: "",
      last_call_summary: "",
      open_tasks: "",
    }
  }

  const [calls, tasks, activities, notes] = await Promise.all([
    prisma.callLog.findMany({
      where,
      include: { transcription: { select: { summary: true, rawTranscript: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: {
        organizationId,
        status: { in: ["TODO", "IN_PROGRESS"] },
        OR: [
          ...(leadId ? [{ leadId }] : []),
          ...(clientId ? [{ clientId }] : []),
        ],
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.note.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        OR: [
          ...(leadId ? [{ leadId }] : []),
          ...(clientId ? [{ clientId }] : []),
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ])

  const callLines = calls.map((call) => {
    const callSummary = summaryText(call.transcription?.summary) ?? compactLine(call.notes) ?? compactLine(call.transcription?.rawTranscript, 220)
    return callSummary ? `- Appel ${call.createdAt.toISOString().slice(0, 10)}: ${callSummary}` : null
  }).filter(Boolean)
  const taskLines = tasks.map((task) => `- ${task.title}${task.description ? `: ${compactLine(task.description, 160)}` : ""}`)
  const activityLines = activities.map((activity) => `- ${activity.createdAt.toISOString().slice(0, 10)} ${activity.title}${activity.description ? `: ${compactLine(activity.description, 160)}` : ""}`)
  const noteLines = notes.map((note) => `- Note ${note.createdAt.toISOString().slice(0, 10)}: ${compactLine(note.content, 220)}`)
  const previousTopics = [
    ...calls.map((call) => compactLine(call.notes, 80)),
    ...tasks.map((task) => compactLine(task.title, 80)),
    ...activities.map((activity) => compactLine(activity.title, 80)),
  ].filter(Boolean).slice(0, 8).join("; ")

  return {
    conversation_memory: [
      "Mémoire CRM récente à utiliser seulement pour contextualiser la conversation, sans donner de conseil:",
      callLines.length ? "Appels précédents:\n" + callLines.join("\n") : null,
      taskLines.length ? "Tâches ouvertes:\n" + taskLines.join("\n") : null,
      activityLines.length ? "Activités récentes:\n" + activityLines.join("\n") : null,
      noteLines.length ? "Notes CRM:\n" + noteLines.join("\n") : null,
    ].filter(Boolean).join("\n\n").slice(0, 3000),
    previous_topics: previousTopics.slice(0, 600),
    last_call_summary: callLines[0]?.replace(/^- Appel \d{4}-\d{2}-\d{2}: /, "").slice(0, 700) ?? "",
    open_tasks: taskLines.join("\n").slice(0, 900),
  }
}
