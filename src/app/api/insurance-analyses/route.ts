import { Prisma } from "@prisma/client"

import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const analysisStatuses = [
  "NOT_STARTED",
  "DRAFT",
  "MISSING_DATA",
  "IN_ANALYSIS",
  "ADVISOR_REVIEW",
  "RECOMMENDATION_PREPARED",
  "WAITING_CLIENT",
  "COMPLETED",
  "DELIVERED",
  "USED_FOR_SUBMISSION",
  "ARCHIVED",
  "NEEDS_UPDATE",
] as const

const openAnalysisStatuses: Array<(typeof analysisStatuses)[number]> = [
  "DRAFT",
  "MISSING_DATA",
  "IN_ANALYSIS",
  "ADVISOR_REVIEW",
  "RECOMMENDATION_PREPARED",
  "WAITING_CLIENT",
  "NEEDS_UPDATE",
]

function parseStatus(value: string | null) {
  if (!value) return null
  return analysisStatuses.includes(value as (typeof analysisStatuses)[number]) ? value as (typeof analysisStatuses)[number] : null
}

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const status = parseStatus(searchParams.get("status"))
    const clientId = searchParams.get("clientId")
    const advisorId = searchParams.get("advisorId")
    const scope = searchParams.get("scope")

    const where: Prisma.InsuranceNeedsAnalysisWhereInput = {
      organizationId,
      ...(status ? { status } : scope === "open" ? { status: { in: openAnalysisStatuses } } : {}),
      ...(clientId ? { clientId } : {}),
      ...(advisorId ? { advisorId } : {}),
    }

    const analyses = await prisma.insuranceNeedsAnalysis.findMany({
      where,
      include: {
        advisor: { select: { id: true, name: true, email: true } },
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        reportDocument: { select: { id: true, name: true, status: true } },
        results: { orderBy: { createdAt: "desc" }, take: 1 },
        recommendations: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 150,
    })

    return ok(analyses)
  } catch (error) {
    return handleApiError(error)
  }
}
