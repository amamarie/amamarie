import { NextResponse } from "next/server"
import { z } from "zod"

import {
  authenticateDeveloperApiRequest,
  generateWebhookSecret,
  getQuotaLimits,
  incrementQuotaUsage,
  parseJsonStringArray,
  writeDeveloperApiLog,
} from "@/lib/developer-api/core"
import { webhookEventLabels } from "@/lib/developer-api/catalog"
import { prisma } from "@/lib/prisma"

const webhookSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().refine((value) => value.startsWith("https://"), "URL HTTPS requise"),
  events: z.array(z.string()).min(1),
  environment: z.enum(["production", "sandbox"]).default("production"),
})

export async function GET(request: Request) {
  const auth = await authenticateDeveloperApiRequest(request, "webhooks:read")
  if (!auth.ok) return developerApiError(auth)
  const webhooks = await prisma.developerWebhook.findMany({
    where: { organizationId: auth.organizationId },
    orderBy: { createdAt: "desc" },
  })
  await incrementQuotaUsage(auth.organizationId, "apiCalls")
  await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "API", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: 200, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, responseBody: { count: webhooks.length } })
  return NextResponse.json({
    data: webhooks.map((webhook) => ({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      events: parseJsonStringArray(webhook.events),
      environment: webhook.environment,
      status: webhook.status.toLowerCase(),
      last_delivery_at: webhook.lastDeliveryAt,
      last_status_code: webhook.lastStatusCode,
      success_rate: webhook.successRate,
      created_at: webhook.createdAt,
    })),
  })
}

export async function POST(request: Request) {
  const auth = await authenticateDeveloperApiRequest(request, "webhooks:create")
  if (!auth.ok) return developerApiError(auth)

  try {
    const body = webhookSchema.parse(await request.json())
    const events = body.events.filter((event) => event in webhookEventLabels)
    if (events.length === 0) {
      return NextResponse.json({ error: { code: "invalid_event", message: "Aucun événement webhook valide." } }, { status: 422 })
    }

    const limits = await getQuotaLimits(auth.organizationId)
    const activeCount = await prisma.developerWebhook.count({ where: { organizationId: auth.organizationId, status: "ACTIVE" } })
    if (activeCount >= limits.activeWebhooks) {
      return NextResponse.json({ error: { code: "quota_exceeded", message: "Limite de webhooks actifs atteinte pour ce forfait." } }, { status: 429 })
    }
    if (body.environment === "sandbox" && !limits.sandbox) {
      return NextResponse.json({ error: { code: "sandbox_only", message: "La sandbox n’est pas incluse dans ce forfait." } }, { status: 403 })
    }

    const generated = generateWebhookSecret()
    const webhook = await prisma.developerWebhook.create({
      data: {
        organizationId: auth.organizationId,
        createdById: auth.userId,
        name: body.name,
        url: body.url,
        environment: body.environment,
        events,
        secretPrefix: generated.secretPrefix,
        secretHash: generated.secretHash,
      },
    })
    await incrementQuotaUsage(auth.organizationId, "apiCalls")
    await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, webhookId: webhook.id, type: "API", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: 201, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, requestBody: { name: body.name, url: body.url, events }, responseBody: { id: webhook.id, status: "created" } })
    return NextResponse.json({ id: webhook.id, name: webhook.name, url: webhook.url, events, environment: webhook.environment, status: webhook.status.toLowerCase(), secret: generated.secret, created_at: webhook.createdAt }, { status: 201 })
  } catch (error) {
    const status = error instanceof z.ZodError ? 422 : 500
    await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "API", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: status, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, errorCode: "webhook_create_failed", errorMessage: error instanceof Error ? error.message : "Webhook create failed" })
    return NextResponse.json({ error: { code: "webhook_create_failed", message: "Impossible de créer le webhook." } }, { status })
  }
}

function developerApiError(auth: Awaited<ReturnType<typeof authenticateDeveloperApiRequest>>) {
  if (auth.ok) throw new Error("Unexpected success")
  void writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "Authentification", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: auth.status, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, errorCode: auth.errorCode, errorMessage: auth.message })
  return NextResponse.json({ error: { code: auth.errorCode, message: auth.message } }, { status: auth.status })
}
