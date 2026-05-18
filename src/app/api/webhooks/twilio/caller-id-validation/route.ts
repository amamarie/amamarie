import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { TwilioWebhookError } from "@/lib/twilio/errors"
import { updateAdvisorTwilioCallerIdFromCallback } from "@/lib/twilio/caller-ids"
import { normalizePhoneNumber } from "@/lib/twilio/phone"
import { parseTwilioFormBody, verifyTwilioRequestWithTokens } from "@/lib/twilio/verify"

export async function POST(request: Request) {
  try {
    const rawBody = await request.text()
    const payload = parseTwilioFormBody(rawBody)
    const twilioCallerIdSid = payload.OutgoingCallerIdSid || null
    const phoneNumber = payload.PhoneNumber || payload.Called || payload.To || null
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber)
    const lookupConditions = [
      ...(twilioCallerIdSid ? [{ twilioCallerIdSid }] : []),
      ...(normalizedPhoneNumber ? [{ phoneNumber: normalizedPhoneNumber }] : []),
    ]
    const records = lookupConditions.length > 0
      ? await prisma.advisorTwilioCallerId.findMany({
          where: { OR: lookupConditions },
          select: {
            organization: {
              select: {
                communicationSettings: {
                  select: { twilioAuthToken: true },
                },
              },
            },
          },
        })
      : []
    const tokens = [
      process.env.TWILIO_AUTH_TOKEN,
      ...records.map((record) => record.organization.communicationSettings?.twilioAuthToken),
    ]

    if (!verifyTwilioRequestWithTokens(request, rawBody, tokens)) {
      throw new TwilioWebhookError("INVALID_TWILIO_SIGNATURE", 403)
    }

    await updateAdvisorTwilioCallerIdFromCallback({
      phoneNumber,
      twilioCallerIdSid,
      verificationStatus: payload.VerificationStatus,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.warn({ action: "twilio_caller_id_validation_failed", name: error instanceof Error ? error.name : "UnknownError" })
    return NextResponse.json({ ok: false }, { status: error instanceof TwilioWebhookError ? error.status : 200 })
  }
}
