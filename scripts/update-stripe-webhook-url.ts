import { existsSync, readFileSync } from "node:fs"
import { writeFileSync } from "node:fs"
import path from "node:path"

type StripeList<T> = {
  data: T[]
}

type StripeWebhookEndpoint = {
  id: string
  url: string
  enabled_events: string[]
  status: string
  secret?: string
}

const targetUrl = process.argv[2] ?? "https://finassuro.com/api/webhooks/stripe"
const recreate = process.argv.includes("--recreate")
const secretOutputIndex = process.argv.indexOf("--secret-output")
const secretOutput = secretOutputIndex >= 0 ? process.argv[secretOutputIndex + 1] : null
const events = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.finalized",
]

function loadEnvFile(fileName: string) {
  const filePath = path.isAbsolute(fileName) ? fileName : path.join(process.cwd(), fileName)
  if (!existsSync(filePath)) return

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue
    const [rawKey, ...rawValueParts] = trimmed.split("=")
    const key = rawKey.trim()
    if (process.env[key]) continue
    process.env[key] = rawValueParts.join("=").trim().replace(/^['"]|['"]$/g, "")
  }
}

loadEnvFile(".env.local")
loadEnvFile(".env.production.local")
loadEnvFile(".env")

function stripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY?.trim() || process.env.STRIPE_API_KEY?.trim()
}

async function stripeRequest<T>(pathName: string, body?: URLSearchParams, init?: RequestInit): Promise<T> {
  const apiKey = stripeSecretKey()
  if (!apiKey) throw new Error("STRIPE_SECRET_KEY ou STRIPE_API_KEY manquant.")

  const response = await fetch(`https://api.stripe.com/v1${pathName.startsWith("/") ? pathName : `/${pathName}`}`, {
    method: body ? "POST" : "GET",
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(init?.headers ?? {}),
    },
    body,
  })

  const text = await response.text()
  const json = text ? JSON.parse(text) as unknown : null
  if (!response.ok) {
    const errorMessage = json && typeof json === "object" && "error" in json
      ? JSON.stringify((json as { error?: unknown }).error)
      : text
    throw new Error(`Stripe API ${response.status}: ${errorMessage}`)
  }

  return json as T
}

function isFinAssuroWebhook(endpoint: StripeWebhookEndpoint) {
  return endpoint.url.includes("/api/webhooks/stripe")
    || endpoint.url.includes("app-crm-conseiller")
    || endpoint.url.includes("finassuro.com")
    || endpoint.url.includes("ngrok-free.dev")
}

async function main() {
  const list = await stripeRequest<StripeList<StripeWebhookEndpoint>>("/webhook_endpoints?limit=100")
  const finassuroEndpoint = list.data.find((endpoint) => endpoint.url === targetUrl)
  const existingEndpoint = finassuroEndpoint ?? list.data.find(isFinAssuroWebhook)

  const params = new URLSearchParams()
  params.set("url", targetUrl)
  events.forEach((event, index) => params.set(`enabled_events[${index}]`, event))

  if (recreate) {
    for (const endpoint of list.data.filter(isFinAssuroWebhook)) {
      await stripeRequest(`/webhook_endpoints/${endpoint.id}`, undefined, { method: "DELETE" })
    }
  } else if (existingEndpoint) {
    const updated = await stripeRequest<StripeWebhookEndpoint>(`/webhook_endpoints/${existingEndpoint.id}`, params)
    console.log(JSON.stringify({
      action: existingEndpoint.url === targetUrl ? "verified" : "updated",
      id: updated.id,
      url: updated.url,
      status: updated.status,
      events: updated.enabled_events,
    }, null, 2))
    return
  }

  const created = await stripeRequest<StripeWebhookEndpoint>("/webhook_endpoints", params)
  if (secretOutput && created.secret) {
    writeFileSync(secretOutput, created.secret, { mode: 0o600 })
  }
  console.log(JSON.stringify({
    action: "created",
    id: created.id,
    url: created.url,
    status: created.status,
    events: created.enabled_events,
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
