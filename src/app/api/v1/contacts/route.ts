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

const contactCreateSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(7),
  status: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  marketing_consent: z.boolean().optional(),
  notes: z.string().optional(),
})

export async function GET(request: Request) {
  const auth = await authenticateDeveloperApiRequest(request, "contacts:read")
  if (!auth.ok) return developerApiError(auth)

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 100)
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1)
  const status = searchParams.get("status")
  const updatedAfter = searchParams.get("updated_after")

  try {
    if (auth.environment === "sandbox") {
      const records = await prisma.developerSandboxRecord.findMany({
        where: { organizationId: auth.organizationId, type: "contact" },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      })
      const total = await prisma.developerSandboxRecord.count({ where: { organizationId: auth.organizationId, type: "contact" } })
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

    const where = {
      organizationId: auth.organizationId,
      ...(updatedAfter ? { updatedAt: { gte: new Date(updatedAfter) } } : {}),
    }
    const [leads, clients, totalLeads, totalClients] = await Promise.all([
      prisma.lead.findMany({
        where: {
          ...where,
          ...(status === "prospect" ? { status: { notIn: ["CONVERTED", "ARCHIVED"] as const } } : {}),
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.client.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
      prisma.client.count({ where }),
    ])
    const data = [
      ...leads.map((lead) => ({
        id: lead.id,
        type: "lead",
        first_name: lead.firstName,
        last_name: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        status: lead.status.toLowerCase(),
        source: lead.source.toLowerCase(),
        created_at: lead.createdAt,
        updated_at: lead.updatedAt,
      })),
      ...clients.map((client) => ({
        id: client.id,
        type: "client",
        first_name: client.firstName,
        last_name: client.lastName,
        email: client.email ?? client.emailPrimary,
        phone: client.phone,
        status: client.status.toLowerCase(),
        source: client.source,
        created_at: client.createdAt,
        updated_at: client.updatedAt,
      })),
    ].slice(0, limit)
    const response = { data, pagination: { page, limit, total: totalLeads + totalClients, has_more: page * limit < totalLeads + totalClients } }

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
      responseBody: { count: data.length },
    })

    return NextResponse.json(response)
  } catch (error) {
    await writeDeveloperApiLog({
      organizationId: auth.organizationId,
      apiKeyId: auth.apiKeyId,
      type: "API",
      method: auth.method,
      endpoint: auth.endpoint,
      environment: auth.environment,
      statusCode: 500,
      latencyMs: Date.now() - auth.startedAt,
      ipAddress: auth.ipAddress,
      errorCode: "server_error",
      errorMessage: error instanceof Error ? error.message : "Server error",
    })
    return NextResponse.json({ error: { code: "server_error", message: "Erreur serveur." } }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await authenticateDeveloperApiRequest(request, "contacts:create")
  if (!auth.ok) return developerApiError(auth)

  let body: unknown
  try {
    body = await request.json()
    const input = contactCreateSchema.parse(body)
    if (auth.environment === "sandbox") {
      const record = await createSandboxRecord({
        organizationId: auth.organizationId,
        type: "contact",
        data: {
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email ?? null,
          phone: input.phone,
          status: "prospect",
          source: input.source ?? "sandbox",
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
        requestBody: maskContactBody(input),
        responseBody: { id: record.externalId, status: "created" },
      })
      return NextResponse.json(record.data, { status: 201 })
    }

    const actorUserId = await getDeveloperApiActorUserId(auth.organizationId, auth.userId)
    const lead = await prisma.lead.create({
      data: {
        organizationId: auth.organizationId,
        advisorId: actorUserId,
        firstName: input.first_name,
        lastName: input.last_name,
        email: input.email || null,
        phone: input.phone,
        source: input.source === "site_web" ? "WEBSITE" : "OTHER",
        notes: input.notes,
      },
    })

    await createCrmActivity({
      organizationId: auth.organizationId,
      userId: actorUserId,
      leadId: lead.id,
      type: "LEAD_CREATED",
      title: "Contact créé via API",
      description: `${lead.firstName} ${lead.lastName} a été ajouté depuis une clé API.`,
      entityType: "Lead",
      entityId: lead.id,
      source: "WEBHOOK",
    })
    await runAutomationsForEvent({
      organizationId: auth.organizationId,
      userId: actorUserId,
      leadId: lead.id,
      event: "LEAD_CREATED",
      title: "Contact créé via API",
      description: `${lead.firstName} ${lead.lastName} a été ajouté depuis une clé API.`,
      payload: { source: "api", email: lead.email, phone: lead.phone },
    })
    await emitDeveloperWebhook({
      organizationId: auth.organizationId,
      event: "contact.created",
      data: { contact_id: lead.id, first_name: lead.firstName, last_name: lead.lastName, email: lead.email, phone: lead.phone, source: "api" },
    })

    const response = {
      id: lead.id,
      first_name: lead.firstName,
      last_name: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      status: "prospect",
      source: "api",
      created_at: lead.createdAt,
    }

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
      requestBody: maskContactBody(input),
      responseBody: { id: lead.id, status: "created" },
    })

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    const status = error instanceof z.ZodError ? 422 : 500
    const code = error instanceof z.ZodError ? "missing_required_field" : "server_error"
    const message = error instanceof z.ZodError ? "Données invalides." : "Erreur serveur."
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
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : message,
    })
    return NextResponse.json({ error: { code, message } }, { status })
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

function maskContactBody(input: z.infer<typeof contactCreateSchema>) {
  return {
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email,
    phone: input.phone.length > 4 ? `${input.phone.slice(0, 4)}******` : "******",
    source: input.source,
    marketing_consent: input.marketing_consent,
  }
}
