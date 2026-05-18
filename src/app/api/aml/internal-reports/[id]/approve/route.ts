import { fail, handleApiError, ok } from "@/lib/api-response"
import { recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const report = await prisma.amlInternalReport.findFirst({ where: { id, organizationId } })
    if (!report) return fail("NOT_FOUND", "Rapport AML introuvable.", 404)

    const updated = await prisma.amlInternalReport.update({
      where: { id },
      data: {
        decision: typeof body.decision === "string" ? body.decision : "APPROVED",
        status: typeof body.status === "string" ? body.status : "CLOSED",
        approvedById: userId,
        submittedToFintrac: Boolean(body.submittedToFintrac),
        fintracReference: typeof body.fintracReference === "string" ? body.fintracReference : report.fintracReference,
        submittedAt: body.submittedToFintrac ? new Date() : report.submittedAt,
        reasonableSuspicionAssessment: typeof body.reasonableSuspicionAssessment === "string" ? body.reasonableSuspicionAssessment : report.reasonableSuspicionAssessment,
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      clientId: report.clientId,
      entityType: "AmlInternalReport",
      entityId: report.id,
      action: "AML_INTERNAL_REPORT_APPROVED",
      oldValue: { status: report.status, decision: report.decision },
      newValue: { status: updated.status, decision: updated.decision, submittedToFintrac: updated.submittedToFintrac },
      source: "advisor",
      sensitivityLevel: "HIGH",
      request,
    })
    const profile = await recalculateAmlRisk({ organizationId, clientId: report.clientId, userId, request })
    return ok({ report: updated, profile })
  } catch (error) {
    return handleApiError(error)
  }
}
