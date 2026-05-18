import { NextResponse } from "next/server"
import { z } from "zod"

import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import {
  authenticateDeveloperApiRequest,
  createSandboxRecord,
  emitDeveloperWebhook,
  getDeveloperApiActorUserId,
  incrementQuotaUsage,
  writeDeveloperApiLog,
} from "@/lib/developer-api/core"
import { prisma } from "@/lib/prisma"

const dealCreateSchema = z.object({
  contact_id: z.string().optional(),
  title: z.string().min(1),
  product_type: z.string().optional(),
  amount: z.number().optional(),
  stage: z.string().optional(),
  expected_close_date: z.coerce.date().optional(),
  owner_id: z.string().optional(),
})

export async function GET(request: Request) {
  const auth = await authenticateDeveloperApiRequest(request, "deals:read")
  if (!auth.ok) return developerApiError(auth)

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 100)
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1)
  if (auth.environment === "sandbox") {
    const records = await prisma.developerSandboxRecord.findMany({
      where: { organizationId: auth.organizationId, type: "deal" },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    })
    const total = await prisma.developerSandboxRecord.count({ where: { organizationId: auth.organizationId, type: "deal" } })
    await incrementQuotaUsage(auth.organizationId, "apiCalls")
    await writeDeveloperApiLog({
      organizationId: auth.organizationId,
      apiKeyId: auth.apiKeyId,
      type: "Sandbox",
      method: auth.method,
      endpoint: auth.endpoint,
      environment: auth.environment,
      statusCode: 200,
      latencyMs: Date.now() - auth.startedAt,
      ipAddress: auth.ipAddress,
      responseBody: { count: records.length },
    })
    return NextResponse.json({ data: records.map((record) => record.data), pagination: { page, limit, total, has_more: page * limit < total } })
  }
  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where: { organizationId: auth.organizationId, status: { notIn: ["ARCHIVED", "LOST"] } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where: { organizationId: auth.organizationId, status: { notIn: ["ARCHIVED", "LOST"] } } }),
  ])

  await incrementQuotaUsage(auth.organizationId, "apiCalls")
  await writeDeveloperApiLog({
    organizationId: auth.organizationId,
    apiKeyId: auth.apiKeyId,
    type: "API",
    method: auth.method,
    endpoint: auth.endpoint,
    environment: auth.environment,
    statusCode: 200,
    latencyMs: Date.now() - auth.startedAt,
    ipAddress: auth.ipAddress,
    responseBody: { count: leads.length },
  })

  return NextResponse.json({
    data: leads.map((lead) => ({
      id: lead.id,
      title: lead.interestType ?? `${lead.firstName} ${lead.lastName}`,
      stage: lead.status.toLowerCase(),
      amount: lead.estimatedValue,
      contact_id: lead.id,
      created_at: lead.createdAt,
    })),
    pagination: { page, limit, total, has_more: page * limit < total },
  })
}

export async function POST(request: Request) {
  const auth = await authenticateDeveloperApiRequest(request, "deals:create")
  if (!auth.ok) return developerApiError(auth)

  try {
    const body = dealCreateSchema.parse(await request.json())
    if (auth.environment === "sandbox") {
      const record = await createSandboxRecord({
        organizationId: auth.organizationId,
        type: "deal",
        data: {
          contact_id: body.contact_id,
          title: body.title,
          product_type: body.product_type,
          amount: body.amount,
          stage: body.stage ?? "besoin_identifie",
          expected_close_date: body.expected_close_date?.toISOString(),
        },
      })
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
        requestBody: { title: body.title, product_type: body.product_type, amount: body.amount, stage: body.stage },
        responseBody: { id: record.externalId, status: "created" },
      })
      return NextResponse.json(record.data, { status: 201 })
    }

    const actorUserId = await getDeveloperApiActorUserId(auth.organizationId, auth.userId)
    const relatedLead = body.contact_id
      ? await prisma.lead.findFirst({ where: { id: body.contact_id, organizationId: auth.organizationId } })
      : null
    const lead = relatedLead
      ? await prisma.lead.update({
          where: { id: relatedLead.id },
          data: {
            advisorId: body.owner_id ?? actorUserId ?? relatedLead.advisorId,
            interestType: body.product_type ?? body.title,
            estimatedValue: body.amount,
            nextAction: body.stage,
            status: "QUALIFIED",
          },
        })
      : await prisma.lead.create({
          data: {
            organizationId: auth.organizationId,
            advisorId: body.owner_id ?? actorUserId,
            firstName: "Prospect",
            lastName: body.title,
            phone: "0000000000",
            source: "OTHER",
            status: "QUALIFIED",
            interestType: body.product_type ?? body.title,
            estimatedValue: body.amount,
            nextAction: body.stage,
          },
        })

    await createCrmActivity({
      organizationId: auth.organizationId,
      userId: actorUserId,
      leadId: lead.id,
      type: "LEAD_STATUS_CHANGED",
      title: "Opportunité créée via API",
      description: body.title,
      entityType: "Lead",
      entityId: lead.id,
      source: "WEBHOOK",
    })
    await runAutomationsForEvent({
      organizationId: auth.organizationId,
      userId: actorUserId,
      leadId: lead.id,
      event: "LEAD_STATUS_CHANGED",
      title: "Opportunité créée via API",
      description: body.title,
      payload: { source: "api", stage: body.stage, amount: body.amount },
    })
    await emitDeveloperWebhook({
      organizationId: auth.organizationId,
      event: "deal.created",
      data: { deal_id: lead.id, title: body.title, stage: body.stage, amount: body.amount },
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
      requestBody: { title: body.title, product_type: body.product_type, amount: body.amount, stage: body.stage },
      responseBody: { id: lead.id, status: "created" },
    })

    return NextResponse.json({
      id: lead.id,
      title: body.title,
      stage: lead.status.toLowerCase(),
      amount: lead.estimatedValue,
      created_at: lead.createdAt,
    }, { status: 201 })
  } catch (error) {
    const status = error instanceof z.ZodError ? 422 : 400
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
      errorCode: "deal_create_failed",
      errorMessage: error instanceof Error ? error.message : "Deal create failed",
    })
    return NextResponse.json({ error: { code: "deal_create_failed", message: "Impossible de créer l’opportunité." } }, { status })
  }
}

function developerApiError(auth: Awaited<ReturnType<typeof authenticateDeveloperApiRequest>>) {
  if (auth.ok) throw new Error("Unexpected success")
  void writeDeveloperApiLog({
    organizationId: auth.organizationId,
    apiKeyId: auth.apiKeyId,
    type: "Authentification",
    method: auth.method,
    endpoint: auth.endpoint,
    environment: auth.environment,
    statusCode: auth.status,
    latencyMs: Date.now() - auth.startedAt,
    ipAddress: auth.ipAddress,
    errorCode: auth.errorCode,
    errorMessage: auth.message,
  })
  return NextResponse.json({ error: { code: auth.errorCode, message: auth.message } }, { status: auth.status })
}
