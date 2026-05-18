import { fail, handleApiError, ok } from "@/lib/api-response"
import { recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const report = await prisma.amlInternalReport.findFirst({ where: { id, organizationId } })
    if (!report) return fail("NOT_FOUND", "Rapport AML introuvable.", 404)

    const updated = await prisma.amlInternalReport.update({
      where: { id },
      data: {
        status: typeof body.status === "string" ? body.status : report.status,
        facts: typeof body.facts === "string" ? body.facts : report.facts,
        context: typeof body.context === "string" ? body.context : report.context,
        indicators: Array.isArray(body.indicators) ? body.indicators : report.indicators,
        reasonableSuspicionAssessment: typeof body.reasonableSuspicionAssessment === "string" ? body.reasonableSuspicionAssessment : report.reasonableSuspicionAssessment,
        decision: typeof body.decision === "string" ? body.decision : report.decision,
        copyDocumentId: typeof body.copyDocumentId === "string" ? body.copyDocumentId : report.copyDocumentId,
      },
    })
    await createAuditLog({
      organizationId,
      userId,
      clientId: report.clientId,
      entityType: "AmlInternalReport",
      entityId: report.id,
      action: "AML_INTERNAL_REPORT_UPDATED",
      oldValue: { status: report.status, decision: report.decision },
      newValue: { status: updated.status, decision: updated.decision },
      source: "advisor",
      sensitivityLevel: "HIGH",
      request,
    })
    await recalculateAmlRisk({ organizationId, clientId: report.clientId, userId, request })
    return ok({ report: updated })
  } catch (error) {
    return handleApiError(error)
  }
}
