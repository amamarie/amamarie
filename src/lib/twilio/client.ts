import twilio from "twilio"

export type TwilioCredentials = {
  accountSid?: string | null
  authToken?: string | null
}

export function getTwilioClient(credentials?: TwilioCredentials) {
  const accountSid = credentials?.accountSid ?? process.env.TWILIO_ACCOUNT_SID
  const authToken = credentials?.authToken ?? process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    throw new Error("TWILIO_NOT_CONFIGURED")
  }

  return twilio(accountSid, authToken)
}

export function getDefaultTwilioPhoneNumber() {
  return process.env.TWILIO_PHONE_NUMBER ?? null
}

export function hasOrganizationTwilioCredentials(credentials?: TwilioCredentials | null) {
  return Boolean(credentials?.accountSid && credentials.authToken)
}
