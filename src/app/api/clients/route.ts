import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { generateCrossSellOpportunitiesForClient } from "@/lib/cross-sell/engine"
import { fail, handleApiError } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { generateRecommendationsForClient } from "@/lib/recommendations/engine"
import { sendClientPortalInvitation } from "@/lib/services/client-portal-invitations"
import { ensureClientFolderStructure } from "@/lib/services/document-folders"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"
import { formatValidationError } from "@/lib/validation-error"
import { assertRateLimit, rateLimitKey } from "@/lib/security/rate-limit"
import {
  assertClientPhoneFormats,
  clientStatusSchema,
  createClientSchema,
  riskProfileSchema,
} from "@/lib/validations/client"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")?.trim()
    const status = clientStatusSchema.safeParse(searchParams.get("status")).success
      ? clientStatusSchema.parse(searchParams.get("status"))
      : undefined
    const riskProfile = riskProfileSchema.safeParse(searchParams.get("riskProfile")).success
      ? riskProfileSchema.parse(searchParams.get("riskProfile"))
      : undefined
    const advisorId = searchParams.get("advisorId") ?? undefined
    const page = Math.max(Number(searchParams.get("page") ?? 1), 1)
    const pageSize = Math.min(Math.max(Number(searchParams.get("pageSize") ?? 25), 1), 100)

    const where: Prisma.ClientWhereInput = {
      organizationId,
      ...(status ? { status } : {}),
      ...(riskProfile ? { riskProfile } : {}),
      ...(advisorId ? { advisorId } : {}),
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { phonePrimary: { contains: query, mode: "insensitive" } },
              { phoneSecondary: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { emailPrimary: { contains: query, mode: "insensitive" } },
              { emailSecondary: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          advisor: { select: { id: true, name: true } },
          products: { select: { id: true, renewalAt: true, status: true } },
          tasks: { select: { id: true, status: true, dueDate: true } },
          documents: { select: { id: true, type: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.client.count({ where }),
    ])

    return NextResponse.json({ data: clients, meta: { page, pageSize, total } })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error({ action: "list_clients_failed", name: error instanceof Error ? error.name : "UnknownError" })

    return NextResponse.json(
      { error: "Impossible de récupérer les clients." },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    assertClientPhoneFormats(body)
    const data = createClientSchema.parse(body)
    const { organizationId, userId } = await getTenantContext()
    assertRateLimit({ key: rateLimitKey(["create_client", organizationId, userId]), limit: 60, windowMs: 60_000 })

    if (data.advisorId) {
      const advisor = await prisma.user.findFirst({ where: { id: data.advisorId, organizationId }, select: { id: true } })
      if (!advisor) return fail("FORBIDDEN", "Conseiller invalide pour cette organisation.", 403)
    }

    const client = await prisma.client.create({
      data: {
        ...data,
        organizationId,
        advisorId: data.advisorId ?? userId,
        phone: data.phone ?? data.phonePrimary,
        email: data.emailPrimary ?? data.email ?? null,
        address: data.address ?? data.addressLine1,
        approximateIncome: data.approximateIncome ?? data.annualIncome,
        dependents: data.dependents ?? data.dependentsCount,
        hasChildren: data.hasChildren ?? Boolean(data.children?.length ?? data.dependents ?? data.dependentsCount),
        goals: data.goals ?? data.financialGoals,
        country: data.country ?? "Canada",
      },
    })

    await createCrmActivity({
      organizationId,
      userId,
      clientId: client.id,
      type: "CLIENT_CREATED",
      title: "Client créé",
      description: `${client.firstName} ${client.lastName} a été ajouté comme client.`,
    })

    await runAutomationsForEvent({
      organizationId,
      userId,
      clientId: client.id,
      event: "CLIENT_CREATED",
      entityType: "client",
      entityId: client.id,
      title: "Client créé",
      description: `${client.firstName} ${client.lastName} a été ajouté comme client.`,
      payload: {
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        email: client.email,
        status: client.status,
        advisorId: client.advisorId,
      },
    })

    await ensureClientFolderStructure({ organizationId, clientId: client.id, userId })

    try {
      const advisor = await prisma.user.findFirst({
        where: { id: client.advisorId ?? userId, organizationId },
        select: { id: true, name: true, email: true, organizationId: true },
      })
      await sendClientPortalInvitation({
        client,
        advisor,
        triggeredByUserId: userId,
        origin: request.headers.get("origin"),
      })
    } catch (portalInvitationError) {
      console.warn({
        action: "client_portal_invitation_failed",
        clientId: client.id,
        name: portalInvitationError instanceof Error ? portalInvitationError.name : "UnknownError",
      })
    }

    try {
      await generateRecommendationsForClient({
        organizationId,
        clientId: client.id,
        advisorId: client.advisorId,
        userId,
      })
    } catch (recommendationError) {
      console.warn({ action: "client_recommendations_failed", clientId: client.id, name: recommendationError instanceof Error ? recommendationError.name : "UnknownError" })
    }

    try {
      await generateCrossSellOpportunitiesForClient({
        organizationId,
        clientId: client.id,
        advisorId: client.advisorId,
        userId,
      })
    } catch (crossSellError) {
      console.warn({ action: "client_cross_sell_failed", clientId: client.id, name: crossSellError instanceof Error ? crossSellError.name : "UnknownError" })
    }

    return NextResponse.json({ data: client }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (error instanceof Error && error.message === "RATE_LIMITED") return handleApiError(error)

    return NextResponse.json({ error: formatValidationError(error, "Données invalides ou erreur serveur.") }, { status: 400 })
  }
}
