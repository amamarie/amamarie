import { NextResponse } from "next/server"

import { createCrmActivity } from "@/lib/crm-events"
import { generateCrossSellOpportunitiesForClient } from "@/lib/cross-sell/engine"
import { prisma } from "@/lib/prisma"
import { generateRecommendationsForClient } from "@/lib/recommendations/engine"
import { ensureClientFolderStructure } from "@/lib/services/document-folders"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"
import { formatValidationError } from "@/lib/validation-error"
import { assertClientPhoneFormats, updateClientSchema } from "@/lib/validations/client"

type RouteContext = {
  params: Promise<{ id: string }>
}

async function findClient(id: string, organizationId: string) {
  const client = await prisma.client.findFirst({
    where: { id, organizationId },
    include: {
      advisor: true,
      products: true,
      tasks: { include: { assignedTo: true }, orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
      calls: { orderBy: { createdAt: "desc" } },
      sms: { orderBy: { createdAt: "desc" } },
      kycProfile: true,
      investmentProfile: true,
      financialGoalItems: { orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
      riskQuestionnaireAnswers: { orderBy: [{ questionCategory: "asc" }, { createdAt: "asc" }] },
      kycVersions: { orderBy: { versionNumber: "desc" }, take: 5 },
      kycAlerts: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, orderBy: [{ severity: "desc" }, { createdAt: "desc" }] },
      complianceAlerts: {
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  })

  if (!client) return null

  const productIds = client.products.map((product) => product.id)
  if (productIds.length === 0) {
    return { ...client, products: [] }
  }

  const analyses = await prisma.insuranceNeedsAnalysis.findMany({
    where: {
      organizationId,
      clientId: id,
      opportunityId: { in: productIds },
      status: { not: "ARCHIVED" },
    },
    orderBy: [{ updatedAt: "desc" }],
    include: { reportDocument: true },
  })

  const analysesByOpportunity = new Map<string, typeof analyses>()
  for (const analysis of analyses) {
    if (!analysis.opportunityId) continue
    const current = analysesByOpportunity.get(analysis.opportunityId) ?? []
    if (current.length < 1) {
      current.push(analysis)
      analysesByOpportunity.set(analysis.opportunityId, current)
    }
  }

  return {
    ...client,
    products: client.products.map((product) => ({
      ...product,
      insuranceNeedsAnalyses: analysesByOpportunity.get(product.id) ?? [],
    })),
  }
}

function buildClientUpdateData(data: ReturnType<typeof updateClientSchema.parse>) {
  const dependentsValue = data.dependents ?? data.dependentsCount
  const childrenValue = data.children

  return {
    ...data,
    ...(data.phone !== undefined || data.phonePrimary !== undefined
      ? { phone: data.phone ?? data.phonePrimary }
      : {}),
    ...(data.email !== undefined || data.emailPrimary !== undefined
      ? { email: data.emailPrimary ?? data.email ?? null }
      : {}),
    ...(data.address !== undefined || data.addressLine1 !== undefined
      ? { address: data.address ?? data.addressLine1 }
      : {}),
    ...(data.approximateIncome !== undefined || data.annualIncome !== undefined
      ? { approximateIncome: data.approximateIncome ?? data.annualIncome }
      : {}),
    ...(dependentsValue !== undefined
      ? { dependents: dependentsValue }
      : {}),
    ...(dependentsValue !== undefined && data.hasChildren === undefined
      ? { hasChildren: Number(dependentsValue) > 0 }
      : {}),
    ...(childrenValue !== undefined && data.hasChildren === undefined
      ? { hasChildren: childrenValue.length > 0 }
      : {}),
    ...(data.goals !== undefined || data.financialGoals !== undefined
      ? { goals: data.goals ?? data.financialGoals }
      : {}),
    ...(data.country !== undefined ? { country: data.country ?? "Canada" } : {}),
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const client = await findClient(id, organizationId)

    if (!client) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 })
    }

    await ensureClientFolderStructure({ organizationId, clientId: client.id, userId })

    const notes = await prisma.note.findMany({
      where: { organizationId, clientId: id, status: { not: "DELETED" } },
      include: { user: true },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    })

    return NextResponse.json({ data: { ...client, noteItems: notes } })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error({
      action: "client_get_failed",
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })

    return NextResponse.json(
      {
        error: "Impossible de récupérer le client.",
        ...(process.env.NODE_ENV === "development" && error instanceof Error
          ? { details: error.message }
          : {}),
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const body = await request.json()
    assertClientPhoneFormats(body)
    const data = updateClientSchema.parse(body)
    const { organizationId, userId } = await getTenantContext()

    const existingClient = await prisma.client.findFirst({
      where: { id, organizationId },
      select: { id: true },
    })

    if (!existingClient) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 })
    }

    await prisma.client.updateMany({
      where: { id, organizationId },
      data: buildClientUpdateData(data),
    })

    const client = await prisma.client.findFirstOrThrow({
      where: { id, organizationId },
    })

    await createCrmActivity({
      organizationId,
      userId,
      clientId: client.id,
      type: "CLIENT_UPDATED",
      title: "Client modifié",
      description: `${client.firstName} ${client.lastName} a été mis à jour.`,
    })

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

    return NextResponse.json({ data: client })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: formatValidationError(error, "Données invalides ou erreur serveur.") },
      { status: 400 }
    )
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const existingClient = await prisma.client.findFirst({
      where: { id, organizationId },
      select: { id: true, firstName: true, lastName: true },
    })

    if (!existingClient) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 })
    }

    await prisma.client.updateMany({
      where: { id, organizationId },
      data: { status: "ARCHIVED" },
    })

    await createCrmActivity({
      organizationId,
      userId,
      clientId: existingClient.id,
      type: "CLIENT_ARCHIVED",
      title: "Client retiré de la liste active",
      description: `${existingClient.firstName} ${existingClient.lastName} a été retiré du portefeuille actif.`,
    })

    return NextResponse.json({ data: existingClient })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: "Impossible de supprimer le client de la liste active." },
      { status: 500 }
    )
  }
}
