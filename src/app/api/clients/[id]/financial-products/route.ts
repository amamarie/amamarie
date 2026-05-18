import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { createCrmActivity } from "@/lib/crm-events"
import { assertKycAllowsOpportunity } from "@/lib/compliance/kyc-opportunity"
import { generateCrossSellOpportunitiesForClient } from "@/lib/cross-sell/engine"
import { prisma } from "@/lib/prisma"
import { generateRecommendationsForClient } from "@/lib/recommendations/engine"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"
import { createFinancialProductSchema } from "@/lib/validations/client"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const payload = createFinancialProductSchema.parse({ ...body, clientId: id })
    const client = await prisma.client.findFirst({
      where: { id, organizationId },
      select: { id: true, advisorId: true },
    })
    if (!client) return NextResponse.json({ error: "Client introuvable." }, { status: 404 })
    if (payload.advisorId) {
      const advisor = await prisma.user.findFirst({
        where: { id: payload.advisorId, organizationId },
        select: { id: true },
      })
      if (!advisor) {
        return NextResponse.json({ error: "Le conseiller assigné est introuvable." }, { status: 404 })
      }
    }

    try {
      await assertKycAllowsOpportunity({
        organizationId,
        clientId: client.id,
        category: payload.category,
        targetStatus: payload.status,
      })
    } catch (gateError) {
      if (gateError instanceof Error && gateError.message.startsWith("KYC_OPPORTUNITY_BLOCKED")) {
        const reason = gateError.message.split(":")[1] ?? "profil client non prêt"
        return NextResponse.json({ error: `L’opportunité est bloquée : ${reason}. Le profil client doit être confirmé, cohérent et utilisable avant recommandation.` }, { status: 409 })
      }
      throw gateError
    }

    const product = await prisma.financialProduct.create({
      data: {
        ...payload,
        organizationId,
        clientId: client.id,
        advisorId: payload.advisorId ?? client.advisorId ?? userId,
      },
    })
    await createCrmActivity({
      organizationId,
      userId,
      clientId: client.id,
      type: "PRODUCT_CREATED",
      title: "Produit financier ajouté",
      description: product.policyNumber ?? product.type,
    })
    try {
      await generateRecommendationsForClient({
        organizationId,
        clientId: client.id,
        advisorId: product.advisorId ?? client.advisorId ?? userId,
        userId,
      })
    } catch (recommendationError) {
      console.warn({ action: "product_recommendations_failed", clientId: client.id, name: recommendationError instanceof Error ? recommendationError.name : "UnknownError" })
    }
    try {
      await generateCrossSellOpportunitiesForClient({
        organizationId,
        clientId: client.id,
        advisorId: product.advisorId ?? client.advisorId ?? userId,
        userId,
      })
    } catch (crossSellError) {
      console.warn({ action: "product_cross_sell_failed", clientId: client.id, name: crossSellError instanceof Error ? crossSellError.name : "UnknownError" })
    }
    return NextResponse.json({ data: product }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    if (error instanceof ZodError) {
      const firstError = error.issues[0]?.message
      return NextResponse.json({ error: firstError ?? "Certains champs du produit sont invalides." }, { status: 422 })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message || "Impossible d'ajouter le produit financier." }, { status: 400 })
    }
    return NextResponse.json({ error: "Impossible d'ajouter le produit financier." }, { status: 400 })
  }
}
