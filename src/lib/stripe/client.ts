import { createHmac, timingSafeEqual } from "node:crypto"

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || process.env.STRIPE_API_KEY?.trim()
}

export function isStripeConfigured() {
  return Boolean(stripeSecretKey())
}

export function stripeWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim()
}

export async function stripeRequest<T>(path: string, body?: URLSearchParams, init?: RequestInit): Promise<T> {
  const apiKey = stripeSecretKey()
  if (!apiKey) throw new Error("STRIPE_NOT_CONFIGURED")

  const response = await fetch(`https://api.stripe.com/v1${path.startsWith("/") ? path : `/${path}`}`, {
    method: body ? "POST" : "GET",
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(init?.headers ?? {}),
    },
    body,
    cache: "no-store",
  })

  const text = await response.text()
  const json = text ? JSON.parse(text) as unknown : null
  if (!response.ok) {
    const message = json && typeof json === "object" && "error" in json
      ? JSON.stringify((json as { error?: unknown }).error).slice(0, 500)
      : text.slice(0, 500)
    throw new Error(`STRIPE_API_FAILED_${response.status}:${message}`)
  }

  return json as T
}

export function verifyStripeWebhookSignature(payload: string, signatureHeader: string | null, secret = stripeWebhookSecret()) {
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET_MISSING")
  if (!signatureHeader) throw new Error("STRIPE_SIGNATURE_MISSING")

  const parts = signatureHeader.split(",").reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split("=")
    if (key && value) acc[key] = [...(acc[key] ?? []), value]
    return acc
  }, {})
  const timestamp = parts.t?.[0]
  const signatures = parts.v1 ?? []
  if (!timestamp || signatures.length === 0) throw new Error("STRIPE_SIGNATURE_INVALID")

  const age = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(age) || age > 300) throw new Error("STRIPE_SIGNATURE_EXPIRED")

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")
  const expectedBuffer = Buffer.from(expected)

  const isValid = signatures.some((signature) => {
    const signatureBuffer = Buffer.from(signature)
    return signatureBuffer.length === expectedBuffer.length && timingSafeEqual(signatureBuffer, expectedBuffer)
  })

  if (!isValid) throw new Error("STRIPE_SIGNATURE_INVALID")
}
