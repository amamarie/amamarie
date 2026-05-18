import { NextResponse } from "next/server"
import { z } from "zod"

import { authenticateDeveloperApiRequest, createSandboxRecord, incrementQuotaUsage, writeDeveloperApiLog } from "@/lib/developer-api/core"
import { prisma } from "@/lib/prisma"

const campaignSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  topic: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"]).default("DRAFT"),
})

export async function GET(request: Request) {
  const auth = await authenticateDeveloperApiRequest(request, "campaigns:read")
  if (!auth.ok) return developerApiError(auth)
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 100)
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1)

  if (auth.environment === "sandbox") {
    const records = await prisma.developerSandboxRecord.findMany({ where: { organizationId: auth.organizationId, type: "campaign" }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit })
    return NextResponse.json({ data: records.map((record) => record.data), pagination: { page, limit, has_more: records.length === limit } })
  }

  const [campaigns, total] = await Promise.all([
    prisma.developerMarketingCampaign.findMany({ where: { organizationId: auth.organizationId }, include: { _count: { select: { subscribers: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.developerMarketingCampaign.count({ where: { organizationId: auth.organizationId } }),
  ])
  await incrementQuotaUsage(auth.organizationId, "apiCalls")
  await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "API", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: 200, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, responseBody: { count: campaigns.length } })
  return NextResponse.json({ data: campaigns.map((campaign) => ({ id: campaign.id, name: campaign.name, description: campaign.description, topic: campaign.topic, status: campaign.status.toLowerCase(), subscribers: campaign._count.subscribers, created_at: campaign.createdAt })), pagination: { page, limit, total, has_more: page * limit < total } })
}

export async function POST(request: Request) {
  const auth = await authenticateDeveloperApiRequest(request, "campaigns:create")
  if (!auth.ok) return developerApiError(auth)
  try {
    const body = campaignSchema.parse(await request.json())
    if (auth.environment === "sandbox") {
      const record = await createSandboxRecord({ organizationId: auth.organizationId, type: "campaign", data: { name: body.name, description: body.description, topic: body.topic, status: body.status.toLowerCase() } })
      await incrementQuotaUsage(auth.organizationId, "apiCalls")
      return NextResponse.json(record.data, { status: 201 })
    }
    const campaign = await prisma.developerMarketingCampaign.create({ data: { organizationId: auth.organizationId, ...body } })
    await incrementQuotaUsage(auth.organizationId, "apiCalls")
    await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "API", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: 201, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, requestBody: body, responseBody: { id: campaign.id, status: "created" } })
    return NextResponse.json({ id: campaign.id, name: campaign.name, status: campaign.status.toLowerCase(), created_at: campaign.createdAt }, { status: 201 })
  } catch (error) {
    const status = error instanceof z.ZodError ? 422 : 500
    await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "API", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: status, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, errorCode: "campaign_create_failed", errorMessage: error instanceof Error ? error.message : "Campaign create failed" })
    return NextResponse.json({ error: { code: "campaign_create_failed", message: "Impossible de créer la campagne." } }, { status })
  }
}

function developerApiError(auth: Awaited<ReturnType<typeof authenticateDeveloperApiRequest>>) {
  if (auth.ok) throw new Error("Unexpected success")
  void writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "Authentification", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: auth.status, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, errorCode: auth.errorCode, errorMessage: auth.message })
  return NextResponse.json({ error: { code: auth.errorCode, message: auth.message } }, { status: auth.status })
}
