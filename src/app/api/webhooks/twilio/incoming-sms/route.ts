import { NextResponse } from "next/server"

import { handleIncomingSms } from "@/lib/services/communications"
import { buildEmptyMessagingResponse } from "@/lib/twilio/calls"
import { TwilioWebhookError } from "@/lib/twilio/errors"
import { findOrganizationByTwilioNumber } from "@/lib/twilio/matching"
import { parseTwilioFormBody, verifyTwilioRequestWithTokens } from "@/lib/twilio/verify"
import { twilioIncomingSmsSchema } from "@/lib/validations/communications"

function twiml(body: string, status = 200) {
  return new NextResponse(body, { status, headers: { "content-type": "text/xml" } })
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const payload = twilioIncomingSmsSchema.parse(parseTwilioFormBody(rawBody))
    const orgMatch = await findOrganizationByTwilioNumber(payload.To)
    if (!verifyTwilioRequestWithTokens(request, rawBody, [process.env.TWILIO_AUTH_TOKEN, orgMatch?.settings?.twilioAuthToken])) {
      throw new TwilioWebhookError("INVALID_TWILIO_SIGNATURE", 403)
    }
    await handleIncomingSms({ from: payload.From, to: payload.To, body: payload.Body, messageSid: payload.MessageSid })
    return twiml(buildEmptyMessagingResponse())
  } catch (error) {
    console.warn({ action: "twilio_incoming_sms_failed", name: error instanceof Error ? error.name : "UnknownError" })
    return twiml(buildEmptyMessagingResponse(), error instanceof TwilioWebhookError ? error.status : 200)
  }
}
