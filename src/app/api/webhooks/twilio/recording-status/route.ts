import { NextResponse } from "next/server"

import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { ensureCallTranscription } from "@/lib/transcription/processor"
import { TwilioWebhookError } from "@/lib/twilio/errors"
import { parseTwilioFormBody, verifyTwilioRequest } from "@/lib/twilio/verify"
import { twilioRecordingStatusSchema } from "@/lib/validations/transcription"

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    if (!verifyTwilioRequest(request, rawBody)) throw new TwilioWebhookError("INVALID_TWILIO_SIGNATURE", 403)
    const payload = twilioRecordingStatusSchema.parse(parseTwilioFormBody(rawBody))
    const call = await prisma.callLog.findUnique({ where: { twilioCallSid: payload.CallSid } })
    if (!call) throw new Error("CALL_NOT_FOUND")

    const duration = payload.RecordingDuration ? Number.parseInt(payload.RecordingDuration, 10) : undefined
    await prisma.callLog.updateMany({
      where: { id: call.id, organizationId: call.organizationId },
      data: {
        recordingUrl: payload.RecordingUrl,
        recordingSid: payload.RecordingSid,
        recordingDurationSeconds: Number.isFinite(duration) ? duration : undefined,
        transcriptionStatus: "NOT_STARTED",
      },
    })
    await ensureCallTranscription({ callLogId: call.id, organizationId: call.organizationId, userId: null })
    await createCrmActivity({ organizationId: call.organizationId, userId: null, leadId: call.leadId, clientId: call.clientId, type: "CALL_RECORDING_AVAILABLE", title: "Enregistrement d’appel disponible", description: call.fromNumber, source: "WEBHOOK", entityType: "CallLog", entityId: call.id })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.warn({ action: "twilio_recording_status_failed", name: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ ok: false }, { status: error instanceof TwilioWebhookError ? error.status : 200 })
  }
}
