import { handleApiError, ok } from "@/lib/api-response"
import { buildCabinetAmlReport } from "@/lib/aml/service"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    const reports = await prisma.auditReport.findMany({
      where: { organizationId, reportType: "AML_CABINET" },
      orderBy: { generatedAt: "desc" },
      take: 25,
    })
    return ok({ reports })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST() {
  try {
    const { organizationId, userId } = await getTenantContext()
    const report = await buildCabinetAmlReport({ organizationId, userId })
    return ok({ report })
  } catch (error) {
    return handleApiError(error)
  }
}
