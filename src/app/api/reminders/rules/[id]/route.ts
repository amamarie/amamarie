import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const existing = await prisma.smartReminderRule.findFirst({ where: { id, organizationId } })
    if (!existing) throw new Error("REMINDER_RULE_NOT_FOUND")
    const rule = await prisma.smartReminderRule.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.description === "string" ? { description: body.description } : {}),
        ...(typeof body.category === "string" ? { category: body.category } : {}),
        ...(typeof body.defaultPriority === "string" ? { defaultPriority: body.defaultPriority } : {}),
        ...(typeof body.defaultDueOffsetDays === "number" ? { defaultDueOffsetDays: body.defaultDueOffsetDays } : {}),
        ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      },
    })
    return ok({ rule })
  } catch (error) {
    return handleApiError(error)
  }
}
