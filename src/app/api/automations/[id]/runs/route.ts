import { fail, handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireOwner()
    const { id } = await context.params
    const { organizationId } = await getTenantContext()
    const rule = await prisma.automationRule.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!rule) return fail("NOT_FOUND", "Automatisation introuvable.", 404)
    const runs = await prisma.automationRun.findMany({
      where: { organizationId, automationRuleId: id },
      orderBy: { startedAt: "desc" },
      take: 100,
    })
    return ok(runs)
  } catch (error) {
    return handleApiError(error)
  }
}
