import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { handleApiError } from "@/lib/api-response"
import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { assertRateLimit, rateLimitKey } from "@/lib/security/rate-limit"
import {
  createStatusFollowUpTask,
  duplicateLeadErrorMessage,
  findDuplicateLead,
} from "@/lib/services/lead-service"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"
import { formatValidationError } from "@/lib/validation-error"
import {
  createLeadSchema,
  leadSourceSchema,
  leadStatusSchema,
  prioritySchema,
} from "@/lib/validations/lead"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")?.trim()
    const status = leadStatusSchema.safeParse(searchParams.get("status")).success
      ? leadStatusSchema.parse(searchParams.get("status"))
      : undefined
    const source = leadSourceSchema.safeParse(searchParams.get("source")).success
      ? leadSourceSchema.parse(searchParams.get("source"))
      : undefined
    const priority = prioritySchema.safeParse(searchParams.get("priority")).success
      ? prioritySchema.parse(searchParams.get("priority"))
      : undefined
    const advisorId = searchParams.get("advisorId") ?? undefined
    const created = searchParams.get("created") ?? undefined
    const page = Math.max(Number(searchParams.get("page") ?? 1), 1)
    const pageSize = Math.min(
      Math.max(Number(searchParams.get("pageSize") ?? 50), 1),
      100
    )
    const sort = searchParams.get("sort") === "updatedAt" ? "updatedAt" : "createdAt"
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const where: Prisma.LeadWhereInput = {
      organizationId,
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(priority ? { priority } : {}),
      ...(advisorId ? { advisorId } : {}),
      ...(created === "this-month" ? { createdAt: { gte: monthStart, lte: monthEnd } } : {}),
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          advisor: true,
          tasks: {
            orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          },
          activities: true,
        },
        orderBy: { [sort]: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.lead.count({ where }),
    ])

    return NextResponse.json({ data: leads, meta: { page, pageSize, total } })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error({ action: "list_leads_failed", name: error instanceof Error ? error.name : "UnknownError" })

    return NextResponse.json(
      { error: "Impossible de récupérer les prospects." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = createLeadSchema.parse(body)
    const { organizationId, userId } = await getTenantContext()
    assertRateLimit({ key: rateLimitKey(["create_lead", organizationId, userId]), limit: 80, windowMs: 60_000 })
    const duplicateLead = await findDuplicateLead({
      prisma,
      organizationId,
      phone: data.phone,
      email: data.email,
    })

    if (duplicateLead && duplicateLead.status !== "ARCHIVED") {
      return NextResponse.json(
        {
          error: duplicateLeadErrorMessage({
            duplicate: duplicateLead,
            phone: data.phone,
          }),
          duplicateId: duplicateLead.id,
        },
        { status: 409 }
      )
    }

    const lead = await prisma.lead.create({
      data: {
        ...data,
        organizationId,
        advisorId: userId,
        email: data.email || null,
      },
    })

    const title = "Prospect créé"
    const description = `${lead.firstName} ${lead.lastName} a été ajouté comme prospect.`

    await createCrmActivity({
      organizationId,
      userId,
      leadId: lead.id,
      type: "LEAD_CREATED",
      title,
      description,
    })

    await runAutomationsForEvent({
      organizationId,
      userId,
      leadId: lead.id,
      event: "LEAD_CREATED",
      title,
      description,
      payload: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone,
        email: lead.email,
        status: lead.status,
        source: lead.source,
        advisorId: lead.advisorId,
      },
    })

    await createStatusFollowUpTask({
      prisma,
      organizationId,
      userId,
      leadId: lead.id,
      status: "NEW",
    })

    return NextResponse.json({ data: lead }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (error instanceof Error && error.message === "RATE_LIMITED") return handleApiError(error)

    return NextResponse.json(
      {
        error: formatValidationError(
          error,
          "Données invalides ou erreur serveur."
        ),
      },
      { status: 400 }
    )
  }
}
