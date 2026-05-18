import { handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    return ok(await prisma.privacyImpactAssessment.findMany({ where: { organizationId }, include: { approvedBy: { select: { id: true, name: true, role: true } } }, orderBy: { updatedAt: "desc" } }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const pia = await prisma.privacyImpactAssessment.create({
      data: {
        organizationId,
        projectName: String(body.projectName ?? "").trim(),
        systemOrVendor: typeof body.systemOrVendor === "string" ? body.systemOrVendor : null,
        dataCategories: body.dataCategories ?? undefined,
        outsideQuebec: Boolean(body.outsideQuebec),
        riskSummary: typeof body.riskSummary === "string" ? body.riskSummary : null,
        mitigationMeasures: typeof body.mitigationMeasures === "string" ? body.mitigationMeasures : null,
        status: String(body.status ?? "DRAFT"),
        reviewDueAt: body.reviewDueAt ? new Date(body.reviewDueAt) : null,
      },
    })
    await createAuditLog({ organizationId, userId, entityType: "PrivacyImpactAssessment", entityId: pia.id, action: "PIA_CREATED", newValue: { projectName: pia.projectName, outsideQuebec: pia.outsideQuebec } })
    return ok(pia, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
