import { fail, handleApiError, ok } from "@/lib/api-response"
import { createCrmActivity, runAutomationsForEvent } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const existing = await prisma.financialProduct.findFirst({
      where: { id, organizationId },
      select: { id: true, clientId: true, policyNumber: true, type: true },
    })

    if (!existing) return fail("NOT_FOUND", "Produit introuvable.", 404)

    const nextReviewAt = new Date()
    nextReviewAt.setFullYear(nextReviewAt.getFullYear() + 1)

    await prisma.financialProduct.updateMany({
      where: { id, organizationId },
      data: {
        lastReviewAt: new Date(),
        nextReviewAt,
        status: "ACTIVE",
      },
    })
    const product = await prisma.financialProduct.findFirstOrThrow({ where: { id, organizationId } })

    await createCrmActivity({
      organizationId,
      userId,
      clientId: existing.clientId,
      type: "PRODUCT_REVIEWED",
      title: "Produit révisé",
      description: existing.policyNumber ?? existing.type,
    })

    await runAutomationsForEvent({
      organizationId,
      userId,
      clientId: existing.clientId,
      event: "PRODUCT_REVIEWED",
      entityType: "product",
      entityId: existing.id,
      title: "Produit révisé",
      description: existing.policyNumber ?? existing.type,
    })

    return ok(product)
  } catch (error) {
    return handleApiError(error)
  }
}
