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
    const screening = await prisma.amlPepScreening.findFirst({ where: { id, organizationId } })
    if (!screening) return fail("NOT_FOUND", "Screening PPV/DOI introuvable.", 404)

    const updated = await prisma.amlPepScreening.update({
      where: { id },
      data: {
        reviewedById: userId,
        reviewedAt: new Date(),
        sourceOfFundsRequired: typeof body.sourceOfFundsRequired === "boolean" ? body.sourceOfFundsRequired : screening.sourceOfFundsRequired,
        sourceOfWealthRequired: typeof body.sourceOfWealthRequired === "boolean" ? body.sourceOfWealthRequired : screening.sourceOfWealthRequired,
        seniorManagementReviewRequired: typeof body.seniorManagementReviewRequired === "boolean" ? body.seniorManagementReviewRequired : screening.seniorManagementReviewRequired,
        notes: typeof body.notes === "string" ? body.notes : screening.notes,
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      clientId: screening.clientId,
      entityType: "AmlPepScreening",
      entityId: screening.id,
      action: "AML_PEP_REVIEW_COMPLETED",
      oldValue: { reviewedAt: screening.reviewedAt, seniorManagementReviewRequired: screening.seniorManagementReviewRequired },
      newValue: { reviewedAt: updated.reviewedAt, seniorManagementReviewRequired: updated.seniorManagementReviewRequired },
      source: "advisor",
      sensitivityLevel: "HIGH",
      request,
    })

    const profile = await recalculateAmlRisk({ organizationId, clientId: screening.clientId, userId, request })
    return ok({ screening: updated, profile })
  } catch (error) {
    return handleApiError(error)
  }
}
