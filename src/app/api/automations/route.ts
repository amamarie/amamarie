import { Prisma } from "@prisma/client"

import { handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import { automationTriggerLabels } from "@/lib/automation/triggers"
import { prisma } from "@/lib/db"
import { createActivity } from "@/lib/services/activities"
import { getTenantContext } from "@/lib/tenant"
import { createAutomationRuleSchema } from "@/lib/validations/automation"

export async function GET() {
  try {
    await requireOwner()
    const { organizationId } = await getTenantContext()
    const [rules, runsThisMonth, failedRuns] = await Promise.all([
      prisma.automationRule.findMany({
        where: { organizationId },
        include: { runs: { orderBy: { startedAt: "desc" }, take: 3 } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.automationRun.count({
        where: {
          organizationId,
          startedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
      prisma.automationRun.count({ where: { organizationId, status: "FAILED" } }),
    ])

    return ok({
      rules,
      summary: {
        activeRules: rules.filter((rule) => rule.isActive).length,
        runsThisMonth,
        failedRuns,
        totalRules: rules.length,
      },
      triggerLabels: automationTriggerLabels,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner()
    const { organizationId, userId } = await getTenantContext()
    const payload = createAutomationRuleSchema.parse(await request.json())
    const rule = await prisma.automationRule.create({
      data: {
        ...payload,
        organizationId,
        createdById: userId,
        updatedById: userId,
        actions: payload.actions as Prisma.InputJsonValue,
        conditions: payload.conditions as Prisma.InputJsonValue | undefined,
      },
    })

    await createActivity({
      organizationId,
      userId,
      automationRuleId: rule.id,
      type: "AUTOMATION_RULE_CREATED",
      title: "Règle d’automatisation créée",
      description: rule.name,
      entityType: "AutomationRule",
      entityId: rule.id,
      source: "USER",
    })

    return ok(rule, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
