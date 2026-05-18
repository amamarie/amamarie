import crypto from "node:crypto"
import { Prisma } from "@prisma/client"

import {
  normalizeSubscriptionPlan,
} from "@/lib/billing/plans"
import {
  developerApiPermissions,
  quotaLimitsByPlan,
  type DeveloperApiPermission,
  type WebhookEventKey,
} from "@/lib/developer-api/catalog"
import { prisma } from "@/lib/prisma"

export function hashSecret(secret: string) {
  return crypto.createHash("sha256").update(secret).digest("hex")
}

export function maskSecret(secret: string) {
  if (secret.length <= 14) return "********"
  return `${secret.slice(0, 10)}••••••••${secret.slice(-4)}`
}

export function generateApiKey(environment: string) {
  const env = environment === "sandbox" ? "test" : "live"
  const publicPart = crypto.randomBytes(5).toString("hex")
  const secretPart = crypto.randomBytes(24).toString("base64url")
  const key = `sk_${env}_${publicPart}_${secretPart}`

  return {
    key,
    keyHash: hashSecret(key),
    keyPrefix: key.slice(0, 20),
  }
}

export function generateWebhookSecret() {
  const secret = `whsec_${crypto.randomBytes(28).toString("base64url")}`
  return {
    secret,
    secretHash: hashSecret(secret),
    secretPrefix: secret.slice(0, 16),
  }
}

export function generateOAuthClientSecret() {
  const clientId = `fa_client_${crypto.randomBytes(10).toString("hex")}`
  const clientSecret = `fa_secret_${crypto.randomBytes(28).toString("base64url")}`
  return {
    clientId,
    clientSecret,
    clientSecretHash: hashSecret(clientSecret),
    clientSecretPrefix: clientSecret.slice(0, 18),
  }
}

export function generateOAuthAccessToken() {
  const token = `oauth_${crypto.randomBytes(32).toString("base64url")}`
  return {
    token,
    tokenHash: hashSecret(token),
    tokenPrefix: token.slice(0, 18),
  }
}

export function permissionsForLevel(level: string, selected: string[] = []): DeveloperApiPermission[] {
  if (level === "read_only") {
    return Object.keys(developerApiPermissions).filter((permission) => permission.endsWith(":read")) as DeveloperApiPermission[]
  }

  if (level === "custom") {
    return selected.filter((permission): permission is DeveloperApiPermission => permission in developerApiPermissions)
  }

  return [
    "contacts:read",
    "contacts:create",
    "deals:read",
    "deals:create",
    "tasks:read",
    "tasks:create",
    "appointments:read",
    "appointments:create",
    "campaigns:read",
    "campaigns:create",
    "campaigns:subscribe",
    "documents:read",
    "documents:request",
    "webhooks:read",
  ]
}

export function parseJsonStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

export function currentQuotaPeriod(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
}

export async function getQuotaLimits(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { subscriptionPlan: true },
  })

  return quotaLimitsByPlan[normalizeSubscriptionPlan(organization?.subscriptionPlan)]
}

export async function incrementQuotaUsage(organizationId: string, field: "apiCalls" | "webhookDeliveries" | "emailApiCalls", amount = 1) {
  const period = currentQuotaPeriod()
  await prisma.developerApiQuotaUsage.upsert({
    where: { organizationId_period: { organizationId, period } },
    create: { organizationId, period, [field]: amount },
    update: { [field]: { increment: amount } },
  })
}

export async function getCurrentQuotaUsage(organizationId: string) {
  const period = currentQuotaPeriod()
  return prisma.developerApiQuotaUsage.upsert({
    where: { organizationId_period: { organizationId, period } },
    create: { organizationId, period },
    update: {},
  })
}

export async function getDeveloperApiActorUserId(organizationId: string, preferredUserId?: string | null) {
  if (preferredUserId) {
    const user = await prisma.user.findFirst({
      where: { id: preferredUserId, organizationId, role: { notIn: ["DEVELOPER", "CLIENT"] } },
      select: { id: true },
    })
    if (user) return user.id
  }

  const owner = await prisma.user.findFirst({
    where: { organizationId, role: { in: ["OWNER", "ADVISOR", "ASSISTANT"] } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  })

  return owner?.id ?? null
}

export async function seedDeveloperSandbox(organizationId: string) {
  const contacts = Array.from({ length: 20 }, (_, index) => {
    const number = index + 1
    return {
      type: "contact",
      externalId: `contact_test_${String(number).padStart(3, "0")}`,
      data: {
        id: `contact_test_${String(number).padStart(3, "0")}`,
        first_name: ["Jean", "Marie", "Nadia", "Lucas", "Sophie"][index % 5],
        last_name: ["Martin", "Aubergiste", "Lefevre", "Roy", "Dubois"][index % 5],
        email: `sandbox${number}@example.com`,
        phone: `+15145550${String(number).padStart(3, "0")}`,
        status: number % 3 === 0 ? "client" : "prospect",
        source: "sandbox",
        created_at: new Date().toISOString(),
      },
    }
  })
  const deals = Array.from({ length: 5 }, (_, index) => ({
    type: "deal",
    externalId: `deal_test_${String(index + 1).padStart(3, "0")}`,
    data: {
      id: `deal_test_${String(index + 1).padStart(3, "0")}`,
      contact_id: contacts[index].externalId,
      title: ["Bilan retraite", "Assurance vie", "Protection revenu", "Épargne enfant", "Mutuelle"][index],
      stage: ["besoin_identifie", "devis_envoye", "relance", "gagne", "perdu"][index],
      amount: [2500, 4200, 1800, 900, 1300][index],
      created_at: new Date().toISOString(),
    },
  }))
  const tasks = Array.from({ length: 8 }, (_, index) => ({
    type: "task",
    externalId: `task_test_${String(index + 1).padStart(3, "0")}`,
    data: {
      id: `task_test_${String(index + 1).padStart(3, "0")}`,
      contact_id: contacts[index].externalId,
      title: ["Relancer", "Préparer dossier", "Envoyer synthèse", "Confirmer rendez-vous"][index % 4],
      status: "todo",
      priority: index % 3 === 0 ? "high" : "normal",
      due_date: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    },
  }))
  const appointments = Array.from({ length: 4 }, (_, index) => ({
    type: "appointment",
    externalId: `appointment_test_${String(index + 1).padStart(3, "0")}`,
    data: {
      id: `appointment_test_${String(index + 1).padStart(3, "0")}`,
      contact_id: contacts[index].externalId,
      title: ["Bilan retraite", "Point assurance vie", "Audit protection", "Rendez-vous suivi"][index],
      starts_at: new Date(Date.now() + (index + 2) * 24 * 60 * 60 * 1000).toISOString(),
      ends_at: new Date(Date.now() + (index + 2) * 24 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString(),
      location: "Google Meet",
      status: "scheduled",
      created_at: new Date().toISOString(),
    },
  }))
  const campaigns = Array.from({ length: 3 }, (_, index) => ({
    type: "campaign",
    externalId: `campaign_test_${String(index + 1).padStart(3, "0")}`,
    data: {
      id: `campaign_test_${String(index + 1).padStart(3, "0")}`,
      name: ["Retraite 2026", "Relance devis", "Prévention familiale"][index],
      topic: ["retraite", "devis", "prevoyance"][index],
      status: index === 0 ? "active" : "draft",
      subscribers: 0,
      created_at: new Date().toISOString(),
    },
  }))
  const documents = Array.from({ length: 5 }, (_, index) => ({
    type: "document",
    externalId: `document_test_${String(index + 1).padStart(3, "0")}`,
    data: {
      id: `document_test_${String(index + 1).padStart(3, "0")}`,
      contact_id: contacts[index].externalId,
      document_type: ["identity_card", "tax_document", "insurance_statement", "beneficiary_form", "client_note"][index],
      name: ["Pièce d’identité", "Avis fiscal", "Relevé assurance", "Clause bénéficiaire", "Note client"][index],
      status: "requested",
      created_at: new Date().toISOString(),
    },
  }))

  await prisma.developerSandboxRecord.deleteMany({ where: { organizationId } })
  await prisma.developerSandboxRecord.createMany({
    data: [...contacts, ...deals, ...tasks, ...appointments, ...campaigns, ...documents].map((record) => ({
      organizationId,
      type: record.type,
      externalId: record.externalId,
      data: record.data,
    })),
  })

  return { contacts: contacts.length, deals: deals.length, tasks: tasks.length, appointments: appointments.length, campaigns: campaigns.length, documents: documents.length }
}

export async function createSandboxRecord({ organizationId, type, data }: { organizationId: string; type: "contact" | "deal" | "task" | "appointment" | "campaign" | "document"; data: Prisma.InputJsonObject }) {
  const prefix =
    type === "contact" ? "contact_test" :
    type === "deal" ? "deal_test" :
    type === "task" ? "task_test" :
    type === "appointment" ? "appointment_test" :
    type === "campaign" ? "campaign_test" :
    "document_test"
  const externalId = `${prefix}_${crypto.randomBytes(5).toString("hex")}`
  const record = await prisma.developerSandboxRecord.create({
    data: {
      organizationId,
      type,
      externalId,
      data: {
        id: externalId,
        ...data,
        created_at: new Date().toISOString(),
      },
    },
  })

  return record
}

export function isIpAllowed(ip: string | null, allowedIps: string | null) {
  if (!allowedIps) return true
  if (!ip) return false
  return allowedIps
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(ip)
}

export function getRequestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null
}

export async function authenticateDeveloperApiRequest(request: Request, requiredPermission: DeveloperApiPermission) {
  const startedAt = Date.now()
  const authorization = request.headers.get("authorization") ?? ""
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : ""
  const endpoint = new URL(request.url).pathname
  const method = request.method
  const ipAddress = getRequestIp(request)

  if (!token) {
    return { ok: false as const, status: 401, errorCode: "invalid_api_key", message: "Clé API manquante.", startedAt, endpoint, method, ipAddress }
  }

  const tokenHash = hashSecret(token)
  const oauthToken = token.startsWith("oauth_")
    ? await prisma.developerOAuthAccessToken.findUnique({
        where: { tokenHash },
        include: { client: true },
      })
    : null

  if (oauthToken) {
    if (oauthToken.status !== "ACTIVE" || oauthToken.expiresAt < new Date() || oauthToken.client.status !== "ACTIVE") {
      return { ok: false as const, status: 401, errorCode: "invalid_oauth_token", message: "Jeton OAuth invalide ou expiré.", startedAt, endpoint, method, ipAddress, organizationId: oauthToken.organizationId, environment: "production" }
    }
    const permissions = parseJsonStringArray(oauthToken.permissions)
    if (!permissions.includes(requiredPermission)) {
      return { ok: false as const, status: 403, errorCode: "permission_denied", message: "Permission insuffisante.", startedAt, endpoint, method, ipAddress, organizationId: oauthToken.organizationId, environment: "production" }
    }
    const [limits, usage] = await Promise.all([
      getQuotaLimits(oauthToken.organizationId),
      getCurrentQuotaUsage(oauthToken.organizationId),
    ])
    if (usage.apiCalls >= limits.apiCalls) {
      return { ok: false as const, status: 429, errorCode: "rate_limit_exceeded", message: "Quota API mensuel dépassé.", startedAt, endpoint, method, ipAddress, organizationId: oauthToken.organizationId, environment: "production" }
    }
    await prisma.developerOAuthAccessToken.update({ where: { id: oauthToken.id }, data: { lastUsedAt: new Date() } })
    await prisma.developerOAuthClient.update({ where: { id: oauthToken.clientId }, data: { lastUsedAt: new Date() } })

    return {
      ok: true as const,
      apiKeyId: undefined,
      organizationId: oauthToken.organizationId,
      userId: null,
      startedAt,
      endpoint,
      method,
      ipAddress,
      environment: "production",
    }
  }

  const apiKey = await prisma.developerApiKey.findUnique({
    where: { keyHash: tokenHash },
    include: { organization: { select: { subscriptionPlan: true } } },
  })

  if (!apiKey || apiKey.status !== "ACTIVE" || apiKey.revokedAt) {
    return { ok: false as const, status: 401, errorCode: "invalid_api_key", message: "Clé API invalide ou révoquée.", startedAt, endpoint, method, ipAddress }
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    await prisma.developerApiKey.update({ where: { id: apiKey.id }, data: { status: "EXPIRED" } })
    return { ok: false as const, status: 401, errorCode: "api_key_expired", message: "Clé API expirée.", startedAt, endpoint, method, ipAddress, apiKeyId: apiKey.id, organizationId: apiKey.organizationId, environment: apiKey.environment }
  }

  if (!isIpAllowed(ipAddress, apiKey.allowedIps)) {
    return { ok: false as const, status: 403, errorCode: "ip_not_allowed", message: "Adresse IP non autorisée.", startedAt, endpoint, method, ipAddress, apiKeyId: apiKey.id, organizationId: apiKey.organizationId, environment: apiKey.environment }
  }

  const permissions = parseJsonStringArray(apiKey.permissions)
  if (!permissions.includes(requiredPermission)) {
    return { ok: false as const, status: 403, errorCode: "permission_denied", message: "Permission insuffisante.", startedAt, endpoint, method, ipAddress, apiKeyId: apiKey.id, organizationId: apiKey.organizationId, environment: apiKey.environment }
  }

  const [limits, usage] = await Promise.all([
    getQuotaLimits(apiKey.organizationId),
    getCurrentQuotaUsage(apiKey.organizationId),
  ])

  const keyQuota = apiKey.quotaMonthly ?? limits.apiCalls
  const effectiveQuota = Math.min(keyQuota, limits.apiCalls)

  if (usage.apiCalls >= effectiveQuota) {
    return { ok: false as const, status: 429, errorCode: "rate_limit_exceeded", message: "Quota API mensuel dépassé.", startedAt, endpoint, method, ipAddress, apiKeyId: apiKey.id, organizationId: apiKey.organizationId, environment: apiKey.environment }
  }

  await prisma.developerApiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })

  return {
    ok: true as const,
    apiKeyId: apiKey.id,
    organizationId: apiKey.organizationId,
    userId: apiKey.createdById,
    startedAt,
    endpoint,
    method,
    ipAddress,
    environment: apiKey.environment,
  }
}

export async function writeDeveloperApiLog(input: {
  organizationId?: string
  apiKeyId?: string
  webhookId?: string
  type: "API" | "Webhook" | "Authentification" | "Sandbox"
  method: string
  endpoint: string
  environment?: string
  statusCode: number
  latencyMs?: number
  ipAddress?: string | null
  errorCode?: string
  errorMessage?: string
  requestBody?: Prisma.InputJsonValue
  responseBody?: Prisma.InputJsonValue
}) {
  if (!input.organizationId) return

  await prisma.developerApiLog.create({
    data: {
      organizationId: input.organizationId,
      apiKeyId: input.apiKeyId,
      webhookId: input.webhookId,
      type: input.type,
      method: input.method,
      endpoint: input.endpoint,
      environment: input.environment ?? "production",
      status: input.statusCode >= 200 && input.statusCode < 300 ? "success" : input.statusCode >= 500 ? "error" : "warning",
      statusCode: input.statusCode,
      latencyMs: input.latencyMs,
      ipAddress: input.ipAddress,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      requestBody: input.requestBody,
      responseBody: input.responseBody,
    },
  })
}

export async function emitDeveloperWebhook({
  organizationId,
  event,
  data,
}: {
  organizationId: string
  event: WebhookEventKey
  data: Prisma.InputJsonValue
}) {
  const webhooks = await prisma.developerWebhook.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
    },
  })

  await Promise.all(
    webhooks
      .filter((webhook) => parseJsonStringArray(webhook.events).includes(event))
      .map(async (webhook) => {
        const payload = {
          id: `evt_${crypto.randomBytes(8).toString("hex")}`,
          event,
          created_at: new Date().toISOString(),
          environment: webhook.environment,
          data,
        }
        const delivery = await prisma.developerWebhookDelivery.create({
          data: {
            organizationId,
            webhookId: webhook.id,
            event,
            payload,
          },
        })
        await attemptDeveloperWebhookDelivery(delivery.id)
      })
  )
}

const retryDelaysMs = [0, 60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 12 * 60 * 60_000]

export async function attemptDeveloperWebhookDelivery(deliveryId: string) {
  const delivery = await prisma.developerWebhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhook: true },
  })
  if (!delivery || delivery.status === "DELIVERED" || delivery.status === "FAILED") return delivery

  const startedAt = Date.now()
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const body = JSON.stringify(delivery.payload)
  const signature = crypto.createHmac("sha256", delivery.webhook.secretHash).update(`${timestamp}.${body}`).digest("hex")

  try {
    const response = await fetch(delivery.webhook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-finadvisor-event": delivery.event,
        "x-finadvisor-timestamp": timestamp,
        "x-finadvisor-signature": signature,
      },
      body,
      signal: AbortSignal.timeout(8_000),
    })
    const latencyMs = Date.now() - startedAt
    const delivered = response.ok
    const nextAttempt = delivery.attempt + 1
    const exhausted = nextAttempt >= delivery.maxAttempts
    const nextRetryDelay = retryDelaysMs[Math.min(nextAttempt, retryDelaysMs.length - 1)]

    await prisma.developerWebhookDelivery.update({
      where: { id: delivery.id },
      data: {
        attempt: nextAttempt,
        status: delivered ? "DELIVERED" : exhausted ? "FAILED" : "RETRY_SCHEDULED",
        nextAttemptAt: delivered || exhausted ? new Date() : new Date(Date.now() + nextRetryDelay),
        lastStatusCode: response.status,
        lastError: delivered ? null : `HTTP ${response.status}`,
        deliveredAt: delivered ? new Date() : null,
      },
    })
    await prisma.developerWebhook.update({
      where: { id: delivery.webhookId },
      data: {
        lastDeliveryAt: new Date(),
        lastStatusCode: response.status,
        failureCount: delivered ? 0 : { increment: 1 },
        successRate: delivered ? 100 : Math.max(0, delivery.webhook.successRate - 10),
        status: !delivered && exhausted ? "INACTIVE" : delivery.webhook.status,
      },
    })
    await incrementQuotaUsage(delivery.organizationId, "webhookDeliveries")
    await writeDeveloperApiLog({
      organizationId: delivery.organizationId,
      webhookId: delivery.webhookId,
      type: "Webhook",
      method: "POST",
      endpoint: delivery.event,
      environment: delivery.webhook.environment,
      statusCode: response.status,
      latencyMs,
      responseBody: { ok: response.ok, attempt: nextAttempt, deliveryId: delivery.id },
    })
  } catch (error) {
    const nextAttempt = delivery.attempt + 1
    const exhausted = nextAttempt >= delivery.maxAttempts
    const nextRetryDelay = retryDelaysMs[Math.min(nextAttempt, retryDelaysMs.length - 1)]
    await prisma.developerWebhookDelivery.update({
      where: { id: delivery.id },
      data: {
        attempt: nextAttempt,
        status: exhausted ? "FAILED" : "RETRY_SCHEDULED",
        nextAttemptAt: exhausted ? new Date() : new Date(Date.now() + nextRetryDelay),
        lastStatusCode: 0,
        lastError: error instanceof Error ? error.message : "Webhook delivery failed",
      },
    })
    await prisma.developerWebhook.update({
      where: { id: delivery.webhookId },
      data: {
        lastDeliveryAt: new Date(),
        lastStatusCode: 0,
        failureCount: { increment: 1 },
        successRate: Math.max(0, delivery.webhook.successRate - 10),
        status: exhausted ? "INACTIVE" : delivery.webhook.status,
      },
    })
    await writeDeveloperApiLog({
      organizationId: delivery.organizationId,
      webhookId: delivery.webhookId,
      type: "Webhook",
      method: "POST",
      endpoint: delivery.event,
      environment: delivery.webhook.environment,
      statusCode: 500,
      latencyMs: Date.now() - startedAt,
      errorCode: "webhook_delivery_failed",
      errorMessage: error instanceof Error ? error.message : "Webhook delivery failed",
    })
  }

  return prisma.developerWebhookDelivery.findUnique({ where: { id: delivery.id } })
}

export async function processDueDeveloperWebhookRetries(limit = 25) {
  const deliveries = await prisma.developerWebhookDelivery.findMany({
    where: {
      status: "RETRY_SCHEDULED",
      nextAttemptAt: { lte: new Date() },
      attempt: { lt: 6 },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  })

  for (const delivery of deliveries) {
    await attemptDeveloperWebhookDelivery(delivery.id)
  }

  return { processed: deliveries.length }
}
