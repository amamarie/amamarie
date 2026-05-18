import { NextResponse } from "next/server"

import { handleIncomingCall } from "@/lib/services/communications"
import { buildIncomingCallResponse } from "@/lib/twilio/calls"
import { TwilioWebhookError } from "@/lib/twilio/errors"
import { findOrganizationByTwilioNumber } from "@/lib/twilio/matching"
import { getAppUrl } from "@/lib/twilio/messaging"
import { parseTwilioFormBody, verifyTwilioRequestWithTokens } from "@/lib/twilio/verify"
import { twilioIncomingCallSchema } from "@/lib/validations/communications"

function twiml(body: string, status = 200) {
  return new NextResponse(body, { status, headers: { "content-type": "text/xml" } })
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const payload = twilioIncomingCallSchema.parse(parseTwilioFormBody(rawBody))
    const orgMatch = await findOrganizationByTwilioNumber(payload.To)
    if (!verifyTwilioRequestWithTokens(request, rawBody, [process.env.TWILIO_AUTH_TOKEN, orgMatch?.settings?.twilioAuthToken])) {
      throw new TwilioWebhookError("INVALID_TWILIO_SIGNATURE", 403)
    }
    await handleIncomingCall({
      from: payload.From,
      to: payload.To,
      callSid: payload.CallSid,
      callStatus: payload.CallStatus,
      createImmediateFollowUp: false,
      sendInitialAutoReply: false,
    })
    return twiml(buildIncomingCallResponse(getAppUrl()))
  } catch (error) {
    console.warn({ action: "twilio_incoming_call_failed", name: error instanceof Error ? error.name : "UnknownError" })
    return twiml(buildIncomingCallResponse(getAppUrl()), error instanceof TwilioWebhookError ? error.status : 200)
  }
}
