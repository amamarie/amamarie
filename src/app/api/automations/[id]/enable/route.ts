import { fail, handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { createActivity } from "@/lib/services/activities"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(_request: Request, context: RouteContext) {
  try {
    await requireOwner()
    const { id } = await context.params
    const { organizationId, userId } = await getTenantContext()
    const existing = await prisma.automationRule.findFirst({ where: { id, organizationId } })
    if (!existing) return fail("NOT_FOUND", "Automatisation introuvable.", 404)
    await prisma.automationRule.updateMany({ where: { id, organizationId }, data: { isActive: true, updatedById: userId } })
    const rule = await prisma.automationRule.findFirstOrThrow({ where: { id, organizationId } })
    await createActivity({ organizationId, userId, automationRuleId: id, type: "AUTOMATION_RULE_UPDATED", title: "Automatisation activée", description: rule.name, entityType: "AutomationRule", entityId: id })
    return ok(rule)
  } catch (error) {
    return handleApiError(error)
  }
}
