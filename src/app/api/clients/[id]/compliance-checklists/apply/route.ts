import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { createComplianceEvent } from "@/lib/compliance/center"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const checklistId = typeof body.checklistId === "string" ? body.checklistId : ""
    const opportunityId = typeof body.opportunityId === "string" ? body.opportunityId : null

    if (!checklistId) return fail("VALIDATION_ERROR", "La checklist est requise.", 422)

    const [client, checklist] = await Promise.all([
      prisma.client.findFirst({ where: { id, organizationId }, select: { id: true, firstName: true, lastName: true, advisorId: true } }),
      prisma.productChecklist.findFirst({
        where: { id: checklistId, organizationId, active: true },
        include: { items: { orderBy: { orderIndex: "asc" } } },
      }),
    ])

    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    if (!checklist) return fail("NOT_FOUND", "Checklist introuvable.", 404)
    if (checklist.items.length === 0) return fail("VALIDATION_ERROR", "Cette checklist ne contient aucun item.", 422)

    const existing = await prisma.clientChecklistResult.findMany({
      where: {
        organizationId,
        clientId: id,
        checklistId,
        itemId: { in: checklist.items.map((item) => item.id) },
        ...(opportunityId ? { opportunityId } : {}),
      },
      select: { itemId: true },
    })
    const existingItemIds = new Set(existing.map((item) => item.itemId).filter(Boolean))
    const missingItems = checklist.items.filter((item) => !existingItemIds.has(item.id))

    if (missingItems.length > 0) {
      await prisma.clientChecklistResult.createMany({
        data: missingItems.map((item) => ({
          organizationId,
          clientId: id,
          checklistId,
          itemId: item.id,
          opportunityId,
          status: item.blocking ? "TO_REVIEW" : "NOT_STARTED",
          note: item.blocking ? "Item bloquant créé automatiquement depuis la checklist produit." : null,
        })),
      })
    }

    let createdTasks = 0
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 3)
    for (const item of missingItems.filter((entry) => entry.blocking)) {
      const title = `Checklist conformité - ${item.label}`
      const existingTask = await prisma.task.findFirst({
        where: {
          organizationId,
          clientId: id,
          title,
          status: { in: ["TODO", "IN_PROGRESS", "WAITING", "OVERDUE", "SNOOZED"] },
        },
        select: { id: true },
      })
      if (existingTask) continue
      await prisma.task.create({
        data: {
          organizationId,
          clientId: id,
          createdById: userId,
          assignedToId: client.advisorId ?? userId,
          type: "COMPLIANCE",
          priority: item.evidenceRequired ? "URGENT" : "HIGH",
          title,
          description: `${checklist.name}\n\n${item.description ?? "Item bloquant de checklist à traiter."}`,
          dueDate,
          isAutomated: true,
        },
      })
      createdTasks += 1
    }

    await createComplianceEvent({
      organizationId,
      userId,
      clientId: id,
      eventCategory: "CHECKLIST",
      eventTitle: `Checklist appliquée - ${checklist.name}`,
      description: `${missingItems.length} item(s) ajouté(s), ${existing.length} déjà présent(s), ${createdTasks} tâche(s) créée(s).`,
      severity: missingItems.some((item) => item.blocking) ? "IMPORTANT" : "INFO",
      status: "OPEN",
      linkedEntityType: "ProductChecklist",
      linkedEntityId: checklist.id,
      metadata: { checklistId, productType: checklist.productType, createdItems: missingItems.length, existingItems: existing.length, createdTasks },
    })

    await createAuditLog({
      organizationId,
      userId,
      clientId: id,
      entityType: "ProductChecklist",
      entityId: checklist.id,
      action: "PRODUCT_CHECKLIST_APPLIED_TO_CLIENT",
      newValue: { clientId: id, checklistId, productType: checklist.productType, createdItems: missingItems.length, existingItems: existing.length, createdTasks },
    })

    return ok({
      checklist: { id: checklist.id, name: checklist.name, productType: checklist.productType },
      createdItems: missingItems.length,
      existingItems: existing.length,
      createdTasks,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
