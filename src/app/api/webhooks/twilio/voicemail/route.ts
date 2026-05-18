import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { handleVoicemailRecording } from "@/lib/services/communications"
import { TwilioWebhookError } from "@/lib/twilio/errors"
import { parseTwilioFormBody, verifyTwilioRequestWithTokens } from "@/lib/twilio/verify"
import { voicemailSchema } from "@/lib/validations/communications"

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const payload = voicemailSchema.parse(parseTwilioFormBody(rawBody))
    const call = await prisma.callLog.findUnique({
      where: { twilioCallSid: payload.CallSid },
      select: { organization: { select: { communicationSettings: { select: { twilioAuthToken: true } } } } },
    })
    if (!verifyTwilioRequestWithTokens(request, rawBody, [process.env.TWILIO_AUTH_TOKEN, call?.organization.communicationSettings?.twilioAuthToken])) {
      throw new TwilioWebhookError("INVALID_TWILIO_SIGNATURE", 403)
    }
    await handleVoicemailRecording({
      callSid: payload.CallSid,
      recordingUrl: payload.RecordingUrl,
      recordingDuration: payload.RecordingDuration,
      recordingSid: payload.RecordingSid,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.warn({ action: "twilio_voicemail_failed", name: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ ok: false }, { status: error instanceof TwilioWebhookError ? error.status : 200 })
  }
}
