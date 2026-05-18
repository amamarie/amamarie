import { fail, handleApiError, ok } from "@/lib/api-response"
import { assertComplianceWorkflowClear, ComplianceWorkflowBlockedError } from "@/lib/compliance/workflow-guards"
import { prisma } from "@/lib/prisma"
import { lockDocumentedRecommendation } from "@/lib/recommendations/documented"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const current = await prisma.productRecommendation.findFirst({
      where: { id, organizationId },
      select: { clientId: true },
    })
    if (!current) return fail("NOT_FOUND", "Recommandation introuvable.", 404)
    await assertComplianceWorkflowClear({ organizationId, clientId: current.clientId, action: "RECOMMENDATION_LOCK" })
    const recommendation = await lockDocumentedRecommendation({ id, organizationId, userId })
    return ok(recommendation)
  } catch (error) {
    if (error instanceof ComplianceWorkflowBlockedError) return fail("COMPLIANCE_WORKFLOW_BLOCKED", "Action bloquée par la conformité: des éléments ouverts doivent être résolus avant le verrouillage.", 409, { blockers: error.blockers })
    return handleApiError(error)
  }
}
