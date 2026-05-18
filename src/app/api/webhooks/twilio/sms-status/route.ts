import { NextResponse } from "next/server"

import { handleSmsStatus } from "@/lib/services/communications"
import { prisma } from "@/lib/prisma"
import { TwilioWebhookError } from "@/lib/twilio/errors"
import { parseTwilioFormBody, verifyTwilioRequestWithTokens } from "@/lib/twilio/verify"
import { smsStatusSchema } from "@/lib/validations/communications"

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const payload = smsStatusSchema.parse(parseTwilioFormBody(rawBody))
    const sms = await prisma.sMSMessage.findUnique({
      where: { twilioMessageSid: payload.MessageSid },
      select: { organization: { select: { communicationSettings: { select: { twilioAuthToken: true } } } } },
    })
    if (!verifyTwilioRequestWithTokens(request, rawBody, [process.env.TWILIO_AUTH_TOKEN, sms?.organization.communicationSettings?.twilioAuthToken])) {
      throw new TwilioWebhookError("INVALID_TWILIO_SIGNATURE", 403)
    }
    await handleSmsStatus({ messageSid: payload.MessageSid, status: payload.MessageStatus ?? payload.SmsStatus, errorCode: payload.ErrorCode, errorMessage: payload.ErrorMessage })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.warn({ action: "twilio_sms_status_failed", name: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ ok: false }, { status: error instanceof TwilioWebhookError ? error.status : 200 })
  }
}
