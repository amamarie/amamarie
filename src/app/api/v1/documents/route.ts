import { NextResponse } from "next/server"
import { z } from "zod"

import {
  authenticateDeveloperApiRequest,
  createSandboxRecord,
  emitDeveloperWebhook,
  getDeveloperApiActorUserId,
  incrementQuotaUsage,
  writeDeveloperApiLog,
} from "@/lib/developer-api/core"
import { prisma } from "@/lib/prisma"

const allowedDocumentTypes = [
  "GOVERNMENT_ID",
  "PROOF_OF_ADDRESS",
  "VOID_CHEQUE",
  "KYC_FORM",
  "RISK_PROFILE",
  "CONSENT_FORM",
  "POLICY_DOCUMENT",
  "PROPOSAL",
  "ILLUSTRATION",
  "INVESTMENT_STATEMENT",
  "INSURANCE_STATEMENT",
  "BENEFICIARY_FORM",
  "SIGNATURE_PAGE",
  "TAX_DOCUMENT",
  "CLIENT_NOTE",
  "OTHER",
] as const

const documentRequestSchema = z.object({
  contact_id: z.string().min(1),
  document_type: z.string().optional(),
  name: z.string().optional(),
  message: z.string().optional(),
  due_date: z.coerce.date().optional(),
})

export async function GET(request: Request) {
  const auth = await authenticateDeveloperApiRequest(request, "documents:read")
  if (!auth.ok) return developerApiError(auth)
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 100)
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1)

  if (auth.environment === "sandbox") {
    const records = await prisma.developerSandboxRecord.findMany({ where: { organizationId: auth.organizationId, type: "document" }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit })
    await incrementQuotaUsage(auth.organizationId, "apiCalls")
    await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "Sandbox", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: 200, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, responseBody: { count: records.length } })
    return NextResponse.json({ data: records.map((record) => record.data), pagination: { page, limit, has_more: records.length === limit } })
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({ where: { organizationId: auth.organizationId, deletedAt: null }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.document.count({ where: { organizationId: auth.organizationId, deletedAt: null } }),
  ])
  await incrementQuotaUsage(auth.organizationId, "apiCalls")
  await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "API", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: 200, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, responseBody: { count: documents.length } })
  return NextResponse.json({ data: documents.map(formatDocument), pagination: { page, limit, total, has_more: page * limit < total } })
}

export async function POST(request: Request) {
  const auth = await authenticateDeveloperApiRequest(request, "documents:request")
  if (!auth.ok) return developerApiError(auth)

  try {
    const body = documentRequestSchema.parse(await request.json())
    const documentType = normalizeDocumentType(body.document_type)
    const name = body.name ?? labelForDocumentType(documentType)

    if (auth.environment === "sandbox") {
      const record = await createSandboxRecord({ organizationId: auth.organizationId, type: "document", data: { contact_id: body.contact_id, document_type: documentType.toLowerCase(), name, message: body.message, due_date: body.due_date?.toISOString(), status: "requested" } })
      await incrementQuotaUsage(auth.organizationId, "apiCalls")
      await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "Sandbox", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: 201, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, requestBody: { contact_id: body.contact_id, document_type: documentType, name }, responseBody: { id: record.externalId, status: "requested" } })
      return NextResponse.json(record.data, { status: 201 })
    }

    const [client, lead] = await Promise.all([
      prisma.client.findFirst({ where: { id: body.contact_id, organizationId: auth.organizationId }, select: { id: true } }),
      prisma.lead.findFirst({ where: { id: body.contact_id, organizationId: auth.organizationId }, select: { id: true } }),
    ])
    const actorUserId = await getDeveloperApiActorUserId(auth.organizationId, auth.userId)

    if (client) {
      const requestRow = await prisma.documentRequest.create({
        data: {
          organizationId: auth.organizationId,
          clientId: client.id,
          requestedById: actorUserId,
          title: name,
          message: body.message,
          status: "SENT",
          dueDate: body.due_date,
          sentAt: new Date(),
          items: {
            create: {
              organizationId: auth.organizationId,
              clientId: client.id,
              documentType,
              name,
              description: body.message,
            },
          },
        },
        include: { items: true },
      })
      await emitDeveloperWebhook({ organizationId: auth.organizationId, event: "document.requested", data: { request_id: requestRow.id, contact_id: client.id, document_type: documentType.toLowerCase() } })
      await incrementQuotaUsage(auth.organizationId, "apiCalls")
      await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "API", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: 201, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, requestBody: { contact_id: body.contact_id, document_type: documentType, name }, responseBody: { id: requestRow.id, status: "requested" } })
      return NextResponse.json({ id: requestRow.id, contact_id: client.id, document_type: documentType.toLowerCase(), name, status: requestRow.status.toLowerCase(), items: requestRow.items.length, created_at: requestRow.createdAt }, { status: 201 })
    }

    const document = await prisma.document.create({
      data: {
        organizationId: auth.organizationId,
        leadId: lead?.id,
        uploadedById: actorUserId,
        type: documentType,
        status: "REQUESTED",
        source: "API",
        name,
        description: body.message,
        isRequired: true,
        requestedAt: new Date(),
        requiredBy: body.due_date,
      },
    })
    await emitDeveloperWebhook({ organizationId: auth.organizationId, event: "document.requested", data: { document_id: document.id, contact_id: body.contact_id, document_type: documentType.toLowerCase() } })
    await incrementQuotaUsage(auth.organizationId, "apiCalls")
    await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "API", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: 201, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, requestBody: { contact_id: body.contact_id, document_type: documentType, name }, responseBody: { id: document.id, status: "requested" } })
    return NextResponse.json(formatDocument(document), { status: 201 })
  } catch (error) {
    const status = error instanceof z.ZodError ? 422 : 500
    await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "API", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: status, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, errorCode: "document_request_failed", errorMessage: error instanceof Error ? error.message : "Document request failed" })
    return NextResponse.json({ error: { code: "document_request_failed", message: "Impossible de créer la demande documentaire." } }, { status })
  }
}

function normalizeDocumentType(value: string | undefined) {
  const normalized = String(value ?? "OTHER").toUpperCase().replaceAll("-", "_").replaceAll(" ", "_")
  if (normalized === "IDENTITY_CARD") return "GOVERNMENT_ID"
  return allowedDocumentTypes.includes(normalized as (typeof allowedDocumentTypes)[number]) ? normalized as (typeof allowedDocumentTypes)[number] : "OTHER"
}

function labelForDocumentType(type: string) {
  return type.toLowerCase().replaceAll("_", " ")
}

function formatDocument(document: { id: string; clientId: string | null; leadId: string | null; type: string; status: string; name: string; description: string | null; requestedAt: Date | null; receivedAt: Date | null; createdAt: Date }) {
  return { id: document.id, contact_id: document.clientId ?? document.leadId, document_type: document.type.toLowerCase(), status: document.status.toLowerCase(), name: document.name, description: document.description, requested_at: document.requestedAt, received_at: document.receivedAt, created_at: document.createdAt }
}

function developerApiError(auth: Awaited<ReturnType<typeof authenticateDeveloperApiRequest>>) {
  if (auth.ok) throw new Error("Unexpected success")
  void writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "Authentification", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: auth.status, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, errorCode: auth.errorCode, errorMessage: auth.message })
  return NextResponse.json({ error: { code: auth.errorCode, message: auth.message } }, { status: auth.status })
}
