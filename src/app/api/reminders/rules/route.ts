import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    const rules = await prisma.smartReminderRule.findMany({ where: { organizationId }, orderBy: [{ category: "asc" }, { name: "asc" }] })
    return ok({ rules })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const rule = await prisma.smartReminderRule.create({
      data: {
        organizationId,
        code: String(body.code ?? `CUSTOM_${Date.now()}`),
        name: String(body.name ?? "Règle personnalisée"),
        description: typeof body.description === "string" ? body.description : null,
        category: String(body.category ?? "RELATION"),
        sourceEntityType: String(body.sourceEntityType ?? "CLIENT"),
        conditionConfig: body.conditionConfig ?? {},
        actionConfig: body.actionConfig ?? { createReminder: true },
        defaultPriority: String(body.defaultPriority ?? "NORMAL"),
        defaultDueOffsetDays: Number(body.defaultDueOffsetDays ?? 7),
        active: body.active !== false,
      },
    })
    return ok({ rule }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
