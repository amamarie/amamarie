import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getDashboardSummary } from "@/lib/services/dashboard"
import { getTenantContext } from "@/lib/tenant"
import { dashboardSummaryQuerySchema } from "@/lib/validations/dashboard"

export async function GET(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, role: true },
    })
    const query = dashboardSummaryQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()))

    if (query.scope === "organization" && user.role !== "OWNER") {
      return fail("FORBIDDEN", "Vous n'avez pas accès à la vue organisation.", 403)
    }

    const summary = await getDashboardSummary({
      organizationId,
      userId,
      role: user.role,
      advisorId: query.advisorId,
      scope: query.scope,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    })

    return ok(summary)
  } catch (error) {
    return handleApiError(error)
  }
}
