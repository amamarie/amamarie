import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/db"
import { getLeadActivities } from "@/lib/services/activities"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

function queryObject(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries())
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const { organizationId } = await getTenantContext()

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId },
      select: { id: true },
    })
    if (!lead) return fail("NOT_FOUND", "Prospect introuvable.", 404)

    const activities = await getLeadActivities(organizationId, id, queryObject(request))
    return ok(activities)
  } catch (error) {
    return handleApiError(error)
  }
}
