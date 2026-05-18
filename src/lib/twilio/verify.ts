import twilio from "twilio"

function paramsFromRawBody(rawBody: string) {
  const params: Record<string, string> = {}
  for (const [key, value] of new URLSearchParams(rawBody).entries()) {
    params[key] = value
  }
  return params
}

function webhookUrl(request: Request) {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto")
  if (forwardedHost) {
    url.host = forwardedHost
    url.protocol = forwardedProto ? `${forwardedProto}:` : url.protocol
  }
  return url.toString()
}

export function parseTwilioFormBody(rawBody: string) {
  return paramsFromRawBody(rawBody)
}

export function verifyTwilioRequest(request: Request, rawBody: string, authToken = process.env.TWILIO_AUTH_TOKEN) {
  const signature = request.headers.get("x-twilio-signature")
  if (!authToken || !signature) return false

  return twilio.validateRequest(authToken, signature, webhookUrl(request), paramsFromRawBody(rawBody))
}

export function verifyTwilioRequestWithTokens(request: Request, rawBody: string, tokens: Array<string | null | undefined>) {
  const uniqueTokens = Array.from(new Set(tokens.filter((token): token is string => Boolean(token))))
  return uniqueTokens.some((token) => verifyTwilioRequest(request, rawBody, token))
}
