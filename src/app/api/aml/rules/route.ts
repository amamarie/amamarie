import { handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    const rules = await prisma.amlRiskRule.findMany({
      where: { organizationId },
      orderBy: [{ category: "asc" }, { ruleKey: "asc" }],
    })
    return ok({ rules })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const ruleKey = typeof body.ruleKey === "string" ? body.ruleKey : `aml.custom.${Date.now()}`
    const rule = await prisma.amlRiskRule.upsert({
      where: { organizationId_ruleKey: { organizationId, ruleKey } },
      update: {
        name: typeof body.name === "string" ? body.name : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        category: typeof body.category === "string" ? body.category : undefined,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        severity: typeof body.severity === "string" ? body.severity : undefined,
        blocking: typeof body.blocking === "boolean" ? body.blocking : undefined,
        scoreImpact: typeof body.scoreImpact === "number" ? body.scoreImpact : undefined,
        condition: body.condition,
        action: body.action,
      },
      create: {
        organizationId,
        createdById: userId,
        ruleKey,
        name: typeof body.name === "string" ? body.name : "Règle AML personnalisée",
        description: typeof body.description === "string" ? body.description : null,
        category: typeof body.category === "string" ? body.category : "CUSTOM",
        enabled: typeof body.enabled === "boolean" ? body.enabled : true,
        severity: typeof body.severity === "string" ? body.severity : "IMPORTANT",
        blocking: Boolean(body.blocking),
        scoreImpact: typeof body.scoreImpact === "number" ? body.scoreImpact : 0,
        condition: body.condition,
        action: body.action,
      },
    })
    await createAuditLog({
      organizationId,
      userId,
      entityType: "AmlRiskRule",
      entityId: rule.id,
      action: "AML_RISK_RULE_UPSERTED",
      newValue: { ruleKey: rule.ruleKey, enabled: rule.enabled, blocking: rule.blocking, scoreImpact: rule.scoreImpact },
      sensitivityLevel: "HIGH",
      request,
    })
    return ok({ rule })
  } catch (error) {
    return handleApiError(error)
  }
}
