import { NextResponse } from "next/server"

import { handleCallStatus } from "@/lib/services/communications"
import { prisma } from "@/lib/prisma"
import { TwilioWebhookError } from "@/lib/twilio/errors"
import { parseTwilioFormBody, verifyTwilioRequestWithTokens } from "@/lib/twilio/verify"
import { callStatusSchema } from "@/lib/validations/communications"

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const payload = callStatusSchema.parse(parseTwilioFormBody(rawBody))
    const call = await prisma.callLog.findUnique({
      where: { twilioCallSid: payload.CallSid },
      select: { organization: { select: { communicationSettings: { select: { twilioAuthToken: true } } } } },
    })
    if (!verifyTwilioRequestWithTokens(request, rawBody, [process.env.TWILIO_AUTH_TOKEN, call?.organization.communicationSettings?.twilioAuthToken])) {
      throw new TwilioWebhookError("INVALID_TWILIO_SIGNATURE", 403)
    }
    await handleCallStatus({ callSid: payload.CallSid, status: payload.CallStatus, duration: payload.CallDuration, recordingUrl: payload.RecordingUrl })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.warn({ action: "twilio_call_status_failed", name: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ ok: false }, { status: error instanceof TwilioWebhookError ? error.status : 200 })
  }
}
