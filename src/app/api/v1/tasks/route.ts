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
import { createTask, getTasks } from "@/lib/services/tasks"

const taskCreateSchema = z.object({
  contact_id: z.string().optional(),
  lead_id: z.string().optional(),
  client_id: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  due_date: z.coerce.date().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  assigned_to: z.string().optional(),
})

export async function GET(request: Request) {
  const auth = await authenticateDeveloperApiRequest(request, "tasks:read")
  if (!auth.ok) return developerApiError(auth)

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 100)
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1)
  if (auth.environment === "sandbox") {
    const records = await prisma.developerSandboxRecord.findMany({
      where: { organizationId: auth.organizationId, type: "task" },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    })
    const total = await prisma.developerSandboxRecord.count({ where: { organizationId: auth.organizationId, type: "task" } })
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
  const tasks = await getTasks({
    organizationId: auth.organizationId,
    skip: (page - 1) * limit,
    take: limit,
  })

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
    responseBody: { count: tasks.length },
  })

  return NextResponse.json({
    data: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status.toLowerCase(),
      priority: task.priority.toLowerCase(),
      due_date: task.dueDate,
      created_at: task.createdAt,
    })),
    pagination: { page, limit, has_more: tasks.length === limit },
  })
}

export async function POST(request: Request) {
  const auth = await authenticateDeveloperApiRequest(request, "tasks:create")
  if (!auth.ok) return developerApiError(auth)

  try {
    const body = taskCreateSchema.parse(await request.json())
    if (auth.environment === "sandbox") {
      const record = await createSandboxRecord({
        organizationId: auth.organizationId,
        type: "task",
        data: {
          contact_id: body.contact_id,
          title: body.title,
          description: body.description,
          due_date: body.due_date?.toISOString(),
          priority: body.priority.toLowerCase(),
          status: "todo",
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
        requestBody: { title: body.title, contact_id: body.contact_id, due_date: body.due_date?.toISOString(), priority: body.priority },
        responseBody: { id: record.externalId, status: "created" },
      })
      return NextResponse.json(record.data, { status: 201 })
    }

    const actorUserId = await getDeveloperApiActorUserId(auth.organizationId, auth.userId)
    if (!actorUserId) {
      return NextResponse.json({ error: { code: "missing_owner", message: "Aucun utilisateur conseiller disponible pour créer la tâche." } }, { status: 422 })
    }
    const task = await createTask({
      organizationId: auth.organizationId,
      userId: actorUserId,
      data: {
        title: body.title,
        description: body.description,
        dueDate: body.due_date,
        priority: body.priority,
        status: "TODO",
        type: "FOLLOW_UP",
        assignedToId: body.assigned_to,
        leadId: body.lead_id ?? body.contact_id,
        clientId: body.client_id,
        isAutomated: true,
      },
    })
    await emitDeveloperWebhook({
      organizationId: auth.organizationId,
      event: "task.created",
      data: { task_id: task.id, title: task.title, due_date: task.dueDate, priority: task.priority },
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
      requestBody: { title: body.title, contact_id: body.contact_id, due_date: body.due_date?.toISOString(), priority: body.priority },
      responseBody: { id: task.id, status: "created" },
    })

    return NextResponse.json({
      id: task.id,
      title: task.title,
      status: task.status.toLowerCase(),
      priority: task.priority.toLowerCase(),
      due_date: task.dueDate,
      created_at: task.createdAt,
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
      errorCode: "task_create_failed",
      errorMessage: error instanceof Error ? error.message : "Task create failed",
    })
    return NextResponse.json({ error: { code: "task_create_failed", message: "Impossible de créer la tâche." } }, { status })
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
