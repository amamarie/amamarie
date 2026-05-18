import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { createNote } from "@/lib/services/notes"
import { createTask } from "@/lib/services/tasks"
import { getOwnedCall } from "@/lib/transcription/access"
import { redactTranscription } from "@/lib/transcription/redact"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"
import { approveTranscriptionSchema } from "@/lib/validations/transcription"

type RouteContext = { params: Promise<{ id: string }> }

function dueDateFromDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = approveTranscriptionSchema.parse(await request.json())
    const call = await getOwnedCall({ organizationId, callId: id })
    if (!call.transcription) return NextResponse.json({ error: "Transcription introuvable." }, { status: 404 })

    const user = await prisma.user.findFirstOrThrow({ where: { id: userId, organizationId }, select: { id: true, organizationId: true, role: true } })
    const note = await createNote({
      user,
      data: {
        clientId: call.clientId ?? undefined,
        leadId: call.leadId ?? undefined,
        title: "Note d’appel validée",
        content: payload.noteContent,
        type: "CALL",
        visibility: "TEAM",
        status: "ACTIVE",
        isPinned: false,
        isSensitive: false,
      },
    })

    const tasks = payload.createTasks
      ? await Promise.all(payload.selectedTasks.map((task) => createTask({
          organizationId,
          userId,
          data: {
            clientId: call.clientId ?? undefined,
            leadId: call.leadId ?? undefined,
            title: task.title,
            description: task.description,
            priority: task.priority,
            dueDate: dueDateFromDays(task.dueInDays),
            status: "TODO",
            type: "FOLLOW_UP",
          },
        })))
      : []

    const transcription = await prisma.callTranscription.update({
      where: { callLogId: id },
      data: {
        status: "APPROVED",
        editedTranscript: payload.editedTranscript,
        approvedAt: new Date(),
        approvedById: userId,
        aiStructuredNote: call.transcription.aiStructuredNote as Prisma.InputJsonValue,
      },
    })
    await prisma.callLog.update({ where: { id: call.id }, data: { transcriptionStatus: "APPROVED" } })
    await createCrmActivity({ organizationId, userId, leadId: call.leadId, clientId: call.clientId, type: "CALL_TRANSCRIPTION_APPROVED", title: "Transcription approuvée", description: "Note d’appel validée et enregistrée.", source: "USER", entityType: "CallLog", entityId: call.id })
    if (tasks.length) await createCrmActivity({ organizationId, userId, leadId: call.leadId, clientId: call.clientId, type: "AI_CALL_TASKS_CREATED", title: "Tâches créées depuis l’appel", description: `${tasks.length} tâche(s) créée(s).`, source: "AI", entityType: "CallLog", entityId: call.id })

    return NextResponse.json({ data: { transcription: redactTranscription(transcription), note, tasks } })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof Error && error.message === "CALL_NOT_FOUND") return NextResponse.json({ error: "Appel introuvable." }, { status: 404 })
    return NextResponse.json({ error: error instanceof Error ? error.message : "Impossible d’approuver la transcription." }, { status: 400 })
  }
}
