import { NextResponse } from "next/server"
import { z } from "zod"

import {
  authenticateDeveloperApiRequest,
  incrementQuotaUsage,
  writeDeveloperApiLog,
} from "@/lib/developer-api/core"
import { prisma } from "@/lib/prisma"

type RouteContext = { params: Promise<{ campaignId: string }> }

const subscriberSchema = z.object({
  contact_id: z.string().min(1),
  email: z.string().email().optional(),
  consent_confirmed: z.boolean().default(false),
})

export async function POST(request: Request, { params }: RouteContext) {
  const auth = await authenticateDeveloperApiRequest(request, "campaigns:subscribe")
  if (!auth.ok) return developerApiError(auth)

  const { campaignId } = await params

  try {
    const body = subscriberSchema.parse(await request.json())

    if (auth.environment === "sandbox") {
      const response = {
        id: `subscriber_test_${Date.now()}`,
        campaign_id: campaignId,
        contact_id: body.contact_id,
        email: body.email ?? null,
        status: "subscribed",
        consent_confirmed: body.consent_confirmed,
        created_at: new Date().toISOString(),
      }
      await incrementQuotaUsage(auth.organizationId, "apiCalls")
      await writeDeveloperApiLog({
        organizationId: auth.organizationId,
        apiKeyId: auth.apiKeyId,
        type: "Sandbox",
        method: auth.method,
        endpoint: auth.endpoint,
        environment: auth.environment,
        statusCode: 201,
        latencyMs: Date.now() - auth.startedAt,
        ipAddress: auth.ipAddress,
        requestBody: { campaign_id: campaignId, contact_id: body.contact_id, consent_confirmed: body.consent_confirmed },
        responseBody: { id: response.id, status: "subscribed" },
      })
      return NextResponse.json(response, { status: 201 })
    }

    const campaign = await prisma.developerMarketingCampaign.findFirst({
      where: { id: campaignId, organizationId: auth.organizationId },
      select: { id: true },
    })
    if (!campaign) {
      return NextResponse.json({ error: { code: "campaign_not_found", message: "Campagne introuvable." } }, { status: 404 })
    }

    const [lead, client] = await Promise.all([
      prisma.lead.findFirst({ where: { id: body.contact_id, organizationId: auth.organizationId }, select: { email: true } }),
      prisma.client.findFirst({ where: { id: body.contact_id, organizationId: auth.organizationId }, select: { email: true, emailPrimary: true } }),
    ])
    const email = body.email ?? lead?.email ?? client?.email ?? client?.emailPrimary ?? null

    const subscriber = await prisma.developerCampaignSubscriber.upsert({
      where: { campaignId_contactId: { campaignId: campaign.id, contactId: body.contact_id } },
      create: {
        organizationId: auth.organizationId,
        campaignId: campaign.id,
        contactId: body.contact_id,
        email,
        consentConfirmed: body.consent_confirmed,
      },
      update: {
        status: "SUBSCRIBED",
        email,
        consentConfirmed: body.consent_confirmed,
      },
    })

    await incrementQuotaUsage(auth.organizationId, "apiCalls")
    await writeDeveloperApiLog({
      organizationId: auth.organizationId,
      apiKeyId: auth.apiKeyId,
      type: "API",
      method: auth.method,
      endpoint: auth.endpoint,
      environment: auth.environment,
      statusCode: 201,
      latencyMs: Date.now() - auth.startedAt,
      ipAddress: auth.ipAddress,
      requestBody: { campaign_id: campaign.id, contact_id: body.contact_id, consent_confirmed: body.consent_confirmed },
      responseBody: { id: subscriber.id, status: "subscribed" },
    })

    return NextResponse.json({
      id: subscriber.id,
      campaign_id: subscriber.campaignId,
      contact_id: subscriber.contactId,
      email: subscriber.email,
      status: subscriber.status.toLowerCase(),
      consent_confirmed: subscriber.consentConfirmed,
      created_at: subscriber.createdAt,
    }, { status: 201 })
  } catch (error) {
    const status = error instanceof z.ZodError ? 422 : 500
    await writeDeveloperApiLog({
      organizationId: auth.organizationId,
      apiKeyId: auth.apiKeyId,
      type: "API",
      method: auth.method,
      endpoint: auth.endpoint,
      environment: auth.environment,
      statusCode: status,
      latencyMs: Date.now() - auth.startedAt,
      ipAddress: auth.ipAddress,
      errorCode: "campaign_subscribe_failed",
      errorMessage: error instanceof Error ? error.message : "Campaign subscribe failed",
    })
    return NextResponse.json({ error: { code: "campaign_subscribe_failed", message: "Impossible d’ajouter le contact à la campagne." } }, { status })
  }
}

function developerApiError(auth: Awaited<ReturnType<typeof authenticateDeveloperApiRequest>>) {
  if (auth.ok) throw new Error("Unexpected success")
  void writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "Authentification", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: auth.status, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, errorCode: auth.errorCode, errorMessage: auth.message })
  return NextResponse.json({ error: { code: auth.errorCode, message: auth.message } }, { status: auth.status })
}
