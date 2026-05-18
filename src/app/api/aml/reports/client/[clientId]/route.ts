import { handleApiError, ok } from "@/lib/api-response"
import { buildClientAmlReport } from "@/lib/aml/service"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ clientId: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { clientId } = await params
    const { organizationId } = await getTenantContext()
    const reports = await prisma.auditReport.findMany({
      where: { organizationId, clientId, reportType: "AML_CLIENT" },
      orderBy: { generatedAt: "desc" },
      take: 25,
    })
    return ok({ reports })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { clientId } = await params
    const { organizationId, userId } = await getTenantContext()
    const report = await buildClientAmlReport({ organizationId, userId, clientId })
    return ok({ report })
  } catch (error) {
    return handleApiError(error)
  }
}
