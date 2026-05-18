import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const createProductTaskSchema = z.object({
  title: z.string().min(1, "Le titre est requis."),
  description: z.string().optional(),
  dueDate: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.date().optional()
  ),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
})

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = createProductTaskSchema.parse(await request.json())
    const product = await prisma.financialProduct.findFirst({
      where: { id, organizationId },
      select: { id: true, clientId: true, policyNumber: true, type: true, advisorId: true },
    })

    if (!product) return fail("NOT_FOUND", "Produit introuvable.", 404)

    const task = await prisma.task.create({
      data: {
        organizationId,
        clientId: product.clientId,
        assignedToId: product.advisorId ?? userId,
        title: payload.title,
        description: payload.description,
        dueDate: payload.dueDate,
        priority: payload.priority,
      },
    })

    await createCrmActivity({
      organizationId,
      userId,
      clientId: product.clientId,
      type: "PRODUCT_TASK_CREATED",
      title: "Tâche de suivi produit créée",
      description: `${payload.title} - ${product.policyNumber ?? product.type}`,
    })

    return ok(task, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
