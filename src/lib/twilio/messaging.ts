import { getTwilioClient, type TwilioCredentials } from "@/lib/twilio/client"

export async function sendTwilioSms({
  to,
  from,
  body,
  statusCallback,
  credentials,
}: {
  to: string
  from: string
  body: string
  statusCallback?: string
  credentials?: TwilioCredentials
}) {
  const client = getTwilioClient(credentials)
  return client.messages.create({
    to,
    from,
    body,
    ...(statusCallback ? { statusCallback } : {}),
  })
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""
}
