import { handleApiError, ok } from "@/lib/api-response"
import { ensureAmlProfile, recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    const reports = await prisma.amlInternalReport.findMany({
      where: { organizationId },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
    return ok({ reports })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    if (typeof body.clientId !== "string") {
      return Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "clientId requis." } }, { status: 422 })
    }
    const profile = await ensureAmlProfile({ organizationId, clientId: body.clientId, userId, request })
    const report = await prisma.amlInternalReport.create({
      data: {
        organizationId,
        clientId: body.clientId,
        amlProfileId: profile.id,
        transactionId: typeof body.transactionId === "string" ? body.transactionId : null,
        reportType: typeof body.reportType === "string" ? body.reportType : "SUSPICIOUS_TRANSACTION_REVIEW",
        facts: typeof body.facts === "string" ? body.facts : null,
        context: typeof body.context === "string" ? body.context : null,
        indicators: Array.isArray(body.indicators) ? body.indicators : undefined,
        reasonableSuspicionAssessment: typeof body.reasonableSuspicionAssessment === "string" ? body.reasonableSuspicionAssessment : null,
        decision: typeof body.decision === "string" ? body.decision : "PENDING",
        preparedById: userId,
      },
    })
    await createAuditLog({
      organizationId,
      userId,
      clientId: body.clientId,
      entityType: "AmlInternalReport",
      entityId: report.id,
      action: "AML_INTERNAL_REPORT_CREATED",
      newValue: { reportType: report.reportType, decision: report.decision, status: report.status },
      source: "advisor",
      sensitivityLevel: "HIGH",
      request,
    })
    await recalculateAmlRisk({ organizationId, clientId: body.clientId, userId, request })
    return ok({ report })
  } catch (error) {
    return handleApiError(error)
  }
}
