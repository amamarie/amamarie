import { fail, handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import { automationTemplates } from "@/lib/automation/defaults"
import { prisma } from "@/lib/db"
import { createActivity } from "@/lib/services/activities"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  try {
    await requireOwner()
    const { id } = await context.params
    const { organizationId, userId } = await getTenantContext()
    const template = automationTemplates.find((item) => item.id === id)
    if (!template) return fail("NOT_FOUND", "Modèle introuvable.", 404)

    const existing = await prisma.automationRule.findFirst({
      where: { organizationId, name: template.name },
    })
    if (existing) {
      const rule = await prisma.automationRule.update({
        where: { id: existing.id },
        data: { isActive: true, updatedById: userId },
      })
      return ok(rule)
    }

    const rule = await prisma.automationRule.create({
      data: {
        organizationId,
        name: template.name,
        description: template.description,
        trigger: template.trigger,
        conditions: template.conditions,
        actions: template.actions,
        isActive: true,
        createdById: userId,
        updatedById: userId,
      },
    })

    await createActivity({ organizationId, userId, automationRuleId: rule.id, type: "AUTOMATION_RULE_CREATED", title: "Modèle d’automatisation installé", description: rule.name, entityType: "AutomationRule", entityId: rule.id })
    return ok(rule, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
