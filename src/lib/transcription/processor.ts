import { Prisma } from "@prisma/client"

import { generateCallNote } from "@/lib/ai/call-notes/generateCallNote"
import { validateTranscriptionSummarySafety } from "@/lib/transcription/safety"
import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/services/notifications"

import { transcribeWithOpenAI } from "./client"
import { assertAudioSize } from "./storage"
import { downloadTwilioRecording } from "./twilio-recordings"
import { assertTranscriptionRateLimit } from "./rate-limit"

function createAudioFile(buffer: Buffer, fileName: string, contentType: string) {
  return new File([new Uint8Array(buffer)], fileName, { type: contentType })
}

export async function ensureCallTranscription({ callLogId, organizationId, userId }: { callLogId: string; organizationId: string; userId?: string | null }) {
  const call = await prisma.callLog.findFirst({ where: { id: callLogId, organizationId } })
  if (!call) throw new Error("CALL_NOT_FOUND")

  return prisma.callTranscription.upsert({
    where: { callLogId },
    update: {
      clientId: call.clientId,
      leadId: call.leadId,
      createdById: userId ?? undefined,
      audioUrl: call.recordingUrl,
      durationSeconds: call.recordingDurationSeconds ?? call.durationSeconds,
    },
    create: {
      organizationId,
      callLogId,
      clientId: call.clientId,
      leadId: call.leadId,
      createdById: userId ?? undefined,
      audioUrl: call.recordingUrl,
      durationSeconds: call.recordingDurationSeconds ?? call.durationSeconds,
      status: "NOT_STARTED",
    },
  })
}

export async function transcribeCall({ callLogId, organizationId, userId, language = "fr" }: { callLogId: string; organizationId: string; userId: string; language?: "fr" | "en" }) {
  assertTranscriptionRateLimit({ organizationId, userId })
  const call = await prisma.callLog.findFirst({
    where: { id: callLogId, organizationId },
    include: { client: true, lead: true },
  })
  if (!call) throw new Error("CALL_NOT_FOUND")
  if (!call.recordingUrl) throw new Error("CALL_RECORDING_NOT_FOUND")

  await ensureCallTranscription({ callLogId, organizationId, userId })
  await prisma.callTranscription.update({
    where: { callLogId },
    data: { status: "PROCESSING", requestedAt: new Date(), startedAt: new Date(), error: null, language },
  })
  await prisma.callLog.update({ where: { id: call.id }, data: { transcriptionStatus: "PROCESSING" } })
  await createCrmActivity({ organizationId, userId, leadId: call.leadId, clientId: call.clientId, type: "CALL_TRANSCRIPTION_STARTED", title: "Transcription démarrée", description: call.fromNumber, source: "USER", entityType: "CallLog", entityId: call.id })

  try {
    const audio = await downloadTwilioRecording({ recordingUrl: call.recordingUrl })
    assertAudioSize(audio.buffer.byteLength)
    const result = await transcribeWithOpenAI({ file: createAudioFile(audio.buffer, audio.fileName, audio.contentType), language })
    const aiStructuredNote = await generateCallNote({
      organizationId,
      userId,
      transcript: result.text,
      client: call.client,
      lead: call.lead,
      callMetadata: { callLogId: call.id, durationSeconds: call.durationSeconds, recordingSid: call.recordingSid },
    })
    const safety = validateTranscriptionSummarySafety(aiStructuredNote)
    const safeStructuredNote = safety.ok ? aiStructuredNote : null

    const transcription = await prisma.callTranscription.update({
      where: { callLogId },
      data: {
        status: "COMPLETED",
        provider: "OPENAI",
        language,
        audioUrl: call.recordingUrl,
        audioMimeType: audio.contentType,
        audioFileSize: audio.buffer.byteLength,
        rawTranscript: result.text,
        aiStructuredNote: safeStructuredNote as Prisma.InputJsonValue,
        summary: safeStructuredNote ? ({ summary: safeStructuredNote.summary, priority: safeStructuredNote.priority } as Prisma.InputJsonValue) : undefined,
        completedAt: new Date(),
      },
    })

    await prisma.callLog.update({ where: { id: call.id }, data: { transcriptionStatus: "COMPLETED" } })
    await createCrmActivity({ organizationId, userId, leadId: call.leadId, clientId: call.clientId, type: "CALL_TRANSCRIBED", title: "Appel transcrit", description: "Transcription prête à valider.", source: "AI", entityType: "CallLog", entityId: call.id })
    await createNotification({
      organizationId,
      userId: call.advisorId ?? userId,
      type: "SYSTEM",
      priority: "NORMAL",
      title: "Transcription prête",
      message: "La transcription de l’appel est prête à valider.",
      actionLabel: "Voir l’appel",
      actionUrl: call.clientId ? `/clients/${call.clientId}` : call.leadId ? `/prospects/${call.leadId}` : "/communications",
      entityType: "CallLog",
      entityId: call.id,
      clientId: call.clientId,
      leadId: call.leadId,
      metadata: { callLogId: call.id, transcriptionId: transcription.id },
    })
    if (safeStructuredNote) await createCrmActivity({ organizationId, userId, leadId: call.leadId, clientId: call.clientId, type: "AI_CALL_NOTE_GENERATED", title: "Note d’appel IA générée", description: safeStructuredNote.summary, source: "AI", entityType: "CallLog", entityId: call.id })
    return transcription
  } catch (error) {
    await prisma.callTranscription.update({
      where: { callLogId },
      data: { status: "FAILED", error: error instanceof Error ? error.message.slice(0, 500) : "Erreur transcription", completedAt: new Date() },
    })
    await prisma.callLog.update({ where: { id: call.id }, data: { transcriptionStatus: "FAILED" } })
    await createCrmActivity({ organizationId, userId, leadId: call.leadId, clientId: call.clientId, type: "CALL_TRANSCRIPTION_FAILED", title: "Transcription échouée", description: "La transcription n’a pas pu être générée.", source: "AI", entityType: "CallLog", entityId: call.id })
    await createNotification({
      organizationId,
      userId: call.advisorId ?? userId,
      type: "SYSTEM",
      priority: "HIGH",
      title: "Transcription échouée",
      message: "La transcription de l’appel n’a pas pu être générée.",
      actionLabel: "Voir l’appel",
      actionUrl: call.clientId ? `/clients/${call.clientId}` : call.leadId ? `/prospects/${call.leadId}` : "/communications",
      entityType: "CallLog",
      entityId: call.id,
      clientId: call.clientId,
      leadId: call.leadId,
      metadata: { callLogId: call.id },
    })
    throw error
  }
}
