import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const productType = searchParams.get("productType")
    return ok(await prisma.productChecklist.findMany({
      where: { organizationId, ...(productType ? { productType } : {}) },
      include: { items: { orderBy: { orderIndex: "asc" } }, approvedBy: { select: { id: true, name: true, role: true } } },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const productType = typeof body.productType === "string" ? body.productType.trim() : ""
    const name = typeof body.name === "string" ? body.name.trim() : ""
    if (!productType || !name) return fail("VALIDATION_ERROR", "Le type de produit et le nom sont requis.", 422)
    const checklist = await prisma.productChecklist.create({
      data: {
        organizationId,
        createdById: userId,
        productType,
        name,
        version: typeof body.version === "string" ? body.version : "1.0",
        description: typeof body.description === "string" ? body.description : null,
        items: {
          create: Array.isArray(body.items) ? body.items.map((item: Record<string, unknown>, index: number) => ({
            organizationId,
            label: String(item.label ?? `Item ${index + 1}`),
            description: typeof item.description === "string" ? item.description : null,
            required: item.required !== false,
            blocking: Boolean(item.blocking),
            evidenceRequired: Boolean(item.evidenceRequired),
            orderIndex: Number(item.orderIndex ?? index),
          })) : [],
        },
      },
      include: { items: { orderBy: { orderIndex: "asc" } } },
    })
    await createAuditLog({ organizationId, userId, entityType: "ProductChecklist", entityId: checklist.id, action: "PRODUCT_CHECKLIST_CREATED", newValue: { productType, name, items: checklist.items.length } })
    return ok(checklist, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
