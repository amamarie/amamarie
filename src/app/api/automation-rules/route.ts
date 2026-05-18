import { Prisma } from "@prisma/client"

import { handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getDefaultOrganizationId } from "@/lib/tenant"
import { createAutomationRuleSchema } from "@/lib/validations/automation"

export async function GET() {
  try {
    await requireOwner()
    const organizationId = await getDefaultOrganizationId()
    const rules = await prisma.automationRule.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    })

    return ok(rules)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner()
    const organizationId = await getDefaultOrganizationId()
    const payload = createAutomationRuleSchema.parse(await request.json())
    const rule = await prisma.automationRule.create({
      data: {
        ...payload,
        organizationId,
        actions: payload.actions as Prisma.InputJsonValue,
        conditions: payload.conditions as Prisma.InputJsonValue | undefined,
      },
    })

    return ok(rule, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
