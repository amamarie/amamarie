import { Prisma } from "@prisma/client"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createActivity } from "@/lib/services/activities"
import { getTenantContext } from "@/lib/tenant"
import { updateAutomationRuleSchema } from "@/lib/validations/automation"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireOwner()
    const { id } = await context.params
    const { organizationId } = await getTenantContext()
    const rule = await prisma.automationRule.findFirst({
      where: { id, organizationId },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 20 } },
    })
    if (!rule) return fail("NOT_FOUND", "Automatisation introuvable.", 404)
    return ok(rule)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireOwner()
    const { id } = await context.params
    const { organizationId, userId } = await getTenantContext()
    const payload = updateAutomationRuleSchema.parse(await request.json())
    const existing = await prisma.automationRule.findFirst({ where: { id, organizationId } })
    if (!existing) return fail("NOT_FOUND", "Automatisation introuvable.", 404)

    await prisma.automationRule.updateMany({
      where: { id, organizationId },
      data: {
        ...payload,
        updatedById: userId,
        actions: payload.actions ? (payload.actions as Prisma.InputJsonValue) : undefined,
        conditions: payload.conditions ? (payload.conditions as Prisma.InputJsonValue) : undefined,
      },
    })
    const rule = await prisma.automationRule.findFirstOrThrow({ where: { id, organizationId } })

    await createActivity({
      organizationId,
      userId,
      automationRuleId: id,
      type: "AUTOMATION_RULE_UPDATED",
      title: "Règle d’automatisation modifiée",
      description: rule.name,
      entityType: "AutomationRule",
      entityId: id,
    })

    return ok(rule)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireOwner()
    const { id } = await context.params
    const { organizationId } = await getTenantContext()
    const rule = await prisma.automationRule.findFirst({ where: { id, organizationId } })
    if (!rule) return fail("NOT_FOUND", "Automatisation introuvable.", 404)
    await prisma.automationRule.deleteMany({ where: { id, organizationId } })
    return ok({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
