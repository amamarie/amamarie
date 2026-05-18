import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { createComplianceEvent } from "@/lib/compliance/center"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId")
    return ok(await prisma.clientChecklistResult.findMany({
      where: { organizationId, checklistId: id, ...(clientId ? { clientId } : {}) },
      include: { item: true, checklist: true, completedBy: { select: { id: true, name: true, role: true } } },
      orderBy: { updatedAt: "desc" },
    }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const clientId = typeof body.clientId === "string" ? body.clientId : ""
    const itemId = typeof body.itemId === "string" ? body.itemId : ""
    const nextStatus = typeof body.status === "string" ? body.status : "COMPLETED"
    if (!clientId || !itemId) return fail("VALIDATION_ERROR", "Le client et l’item sont requis.", 422)
    const result = await prisma.clientChecklistResult.upsert({
      where: { id: typeof body.resultId === "string" ? body.resultId : "__new__" },
      create: {
        organizationId,
        clientId,
        checklistId: id,
        itemId,
        completedById: userId,
        opportunityId: typeof body.opportunityId === "string" ? body.opportunityId : null,
        status: nextStatus,
        evidenceDocumentId: typeof body.evidenceDocumentId === "string" ? body.evidenceDocumentId : null,
        note: typeof body.note === "string" ? body.note : null,
        completedAt: nextStatus === "COMPLETED" ? new Date() : null,
      },
      update: {
        completedById: userId,
        status: nextStatus,
        evidenceDocumentId: typeof body.evidenceDocumentId === "string" ? body.evidenceDocumentId : undefined,
        note: typeof body.note === "string" ? body.note : undefined,
        completedAt: nextStatus === "COMPLETED" ? new Date() : null,
      },
      include: {
        checklist: { select: { id: true, name: true, productType: true } },
        item: { select: { id: true, label: true, description: true, blocking: true, evidenceRequired: true } },
        client: { select: { id: true, advisorId: true, firstName: true, lastName: true } },
      },
    })

    if (result.item) {
      const title = `Checklist conformité - ${result.item.label}`
      if (nextStatus === "COMPLETED") {
        await prisma.task.updateMany({
          where: {
            organizationId,
            clientId,
            title,
            status: { in: ["TODO", "IN_PROGRESS", "WAITING", "OVERDUE", "SNOOZED"] },
          },
          data: {
            status: "DONE",
            completedAt: new Date(),
            outcome: "Item de checklist complété depuis le dossier client.",
          },
        })
      } else if (result.item.blocking) {
        const existingTask = await prisma.task.findFirst({
          where: { organizationId, clientId, title },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true },
        })
        const taskData = {
          assignedToId: result.client.advisorId ?? userId,
          priority: nextStatus === "EXCEPTION" || result.item.evidenceRequired ? "URGENT" as const : "HIGH" as const,
          status: "TODO" as const,
          completedAt: null,
          outcome: null,
          description: `${result.checklist.name}\n\n${result.item.description ?? "Item bloquant de checklist à traiter."}${nextStatus === "EXCEPTION" ? "\n\nException à justifier ou faire approuver par conformité." : ""}`,
        }
        if (existingTask) {
          await prisma.task.update({ where: { id: existingTask.id }, data: taskData })
        } else {
          const dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + 3)
          await prisma.task.create({
            data: {
              organizationId,
              clientId,
              createdById: userId,
              type: "COMPLIANCE",
              title,
              dueDate,
              isAutomated: true,
              ...taskData,
            },
          })
        }
      }
    }

    if (nextStatus === "EXCEPTION") {
      await createComplianceEvent({
        organizationId,
        userId,
        clientId,
        eventCategory: "CHECKLIST",
        eventTitle: `Exception checklist - ${result.item?.label ?? result.checklist.name}`,
        description: typeof body.note === "string" ? body.note : "Exception déclarée sur un item de checklist.",
        severity: result.item?.blocking ? "IMPORTANT" : "ATTENTION",
        status: "OPEN",
        linkedEntityType: "ClientChecklistResult",
        linkedEntityId: result.id,
        metadata: { checklistId: id, itemId, status: nextStatus },
      })
    }

    await createAuditLog({ organizationId, userId, clientId, entityType: "ClientChecklistResult", entityId: result.id, action: "CHECKLIST_RESULT_UPDATED", newValue: { checklistId: id, itemId, status: result.status } })
    return ok(result)
  } catch (error) {
    return handleApiError(error)
  }
}
