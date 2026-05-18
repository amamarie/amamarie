import { NextResponse } from "next/server"
import { z } from "zod"

import {
  authenticateDeveloperApiRequest,
  createSandboxRecord,
  emitDeveloperWebhook,
  incrementQuotaUsage,
  writeDeveloperApiLog,
} from "@/lib/developer-api/core"
import { prisma } from "@/lib/prisma"

const appointmentSchema = z.object({
  contact_id: z.string().optional(),
  title: z.string().min(1),
  starts_at: z.coerce.date(),
  ends_at: z.coerce.date(),
  location: z.string().optional(),
  assigned_to: z.string().optional(),
}).refine((value) => value.ends_at > value.starts_at, {
  message: "ends_at must be after starts_at",
  path: ["ends_at"],
})

export async function GET(request: Request) {
  const auth = await authenticateDeveloperApiRequest(request, "appointments:read")
  if (!auth.ok) return developerApiError(auth)
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 100)
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1)

  if (auth.environment === "sandbox") {
    const records = await prisma.developerSandboxRecord.findMany({ where: { organizationId: auth.organizationId, type: "appointment" }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit })
    return NextResponse.json({ data: records.map((record) => record.data), pagination: { page, limit, has_more: records.length === limit } })
  }

  const [items, total] = await Promise.all([
    prisma.developerAppointment.findMany({ where: { organizationId: auth.organizationId }, orderBy: { startsAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.developerAppointment.count({ where: { organizationId: auth.organizationId } }),
  ])
  await incrementQuotaUsage(auth.organizationId, "apiCalls")
  await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "API", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: 200, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, responseBody: { count: items.length } })
  return NextResponse.json({ data: items.map(formatAppointment), pagination: { page, limit, total, has_more: page * limit < total } })
}

export async function POST(request: Request) {
  const auth = await authenticateDeveloperApiRequest(request, "appointments:create")
  if (!auth.ok) return developerApiError(auth)

  try {
    const body = appointmentSchema.parse(await request.json())
    if (auth.environment === "sandbox") {
      const record = await createSandboxRecord({ organizationId: auth.organizationId, type: "appointment", data: { ...body, starts_at: body.starts_at.toISOString(), ends_at: body.ends_at.toISOString(), status: "scheduled" } })
      await incrementQuotaUsage(auth.organizationId, "apiCalls")
      return NextResponse.json(record.data, { status: 201 })
    }

    const lead = body.contact_id ? await prisma.lead.findFirst({ where: { id: body.contact_id, organizationId: auth.organizationId }, select: { id: true } }) : null
    const client = !lead && body.contact_id ? await prisma.client.findFirst({ where: { id: body.contact_id, organizationId: auth.organizationId }, select: { id: true } }) : null
    const appointment = await prisma.developerAppointment.create({
      data: {
        organizationId: auth.organizationId,
        contactId: body.contact_id,
        leadId: lead?.id,
        clientId: client?.id,
        title: body.title,
        startsAt: body.starts_at,
        endsAt: body.ends_at,
        location: body.location,
        assignedTo: body.assigned_to,
      },
    })
    await emitDeveloperWebhook({ organizationId: auth.organizationId, event: "appointment.created", data: { appointment_id: appointment.id, title: appointment.title, starts_at: appointment.startsAt.toISOString(), ends_at: appointment.endsAt.toISOString() } })
    await incrementQuotaUsage(auth.organizationId, "apiCalls")
    await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "API", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: 201, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, requestBody: { title: body.title, starts_at: body.starts_at.toISOString(), ends_at: body.ends_at.toISOString() }, responseBody: { id: appointment.id, status: "created" } })
    return NextResponse.json(formatAppointment(appointment), { status: 201 })
  } catch (error) {
    const status = error instanceof z.ZodError ? 422 : 500
    await writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "API", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: status, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, errorCode: "appointment_create_failed", errorMessage: error instanceof Error ? error.message : "Appointment create failed" })
    return NextResponse.json({ error: { code: "appointment_create_failed", message: "Impossible de créer le rendez-vous." } }, { status })
  }
}

function formatAppointment(appointment: { id: string; contactId: string | null; title: string; startsAt: Date; endsAt: Date; location: string | null; assignedTo: string | null; status: string; createdAt: Date }) {
  return { id: appointment.id, contact_id: appointment.contactId, title: appointment.title, starts_at: appointment.startsAt, ends_at: appointment.endsAt, location: appointment.location, assigned_to: appointment.assignedTo, status: appointment.status.toLowerCase(), created_at: appointment.createdAt }
}

function developerApiError(auth: Awaited<ReturnType<typeof authenticateDeveloperApiRequest>>) {
  if (auth.ok) throw new Error("Unexpected success")
  void writeDeveloperApiLog({ organizationId: auth.organizationId, apiKeyId: auth.apiKeyId, type: "Authentification", method: auth.method, endpoint: auth.endpoint, environment: auth.environment, statusCode: auth.status, latencyMs: Date.now() - auth.startedAt, ipAddress: auth.ipAddress, errorCode: auth.errorCode, errorMessage: auth.message })
  return NextResponse.json({ error: { code: auth.errorCode, message: auth.message } }, { status: auth.status })
}
