import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const valueHistorySchema = z.object({
  value: z.coerce.number().nonnegative("La valeur ne peut pas être négative."),
  valueDate: z.preprocess(
    (value) => (value === "" || value === null ? new Date() : value),
    z.coerce.date()
  ),
  notes: z.string().optional(),
})

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const product = await prisma.financialProduct.findFirst({
      where: { id, organizationId },
      select: { id: true },
    })

    if (!product) return fail("NOT_FOUND", "Produit introuvable.", 404)

    const history = await prisma.financialProductValueHistory.findMany({
      where: { productId: product.id, organizationId },
      orderBy: { valueDate: "asc" },
    })

    return ok(history)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = valueHistorySchema.parse(await request.json())
    const product = await prisma.financialProduct.findFirst({
      where: { id, organizationId },
      select: { id: true, clientId: true, type: true, accountNumber: true, contractNumber: true },
    })

    if (!product) return fail("NOT_FOUND", "Produit introuvable.", 404)

    const history = await prisma.financialProductValueHistory.create({
      data: {
        organizationId,
        productId: product.id,
        clientId: product.clientId,
        value: payload.value,
        valueDate: payload.valueDate,
        notes: payload.notes,
      },
    })

    await prisma.financialProduct.update({
      where: { id: product.id },
      data: {
        accountValue: payload.value,
        lastReviewAt: payload.valueDate,
      },
    })

    await createCrmActivity({
      organizationId,
      userId,
      clientId: product.clientId,
      type: "PRODUCT_UPDATED",
      title: "Valeur du produit mise à jour",
      description: product.accountNumber ?? product.contractNumber ?? product.type,
    })

    return ok(history, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
