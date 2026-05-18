import { fail, handleApiError, ok } from "@/lib/api-response"
import { createComplianceEvent } from "@/lib/compliance/center"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    return ok(await prisma.supervisionReview.findMany({
      where: { organizationId },
      include: { client: { select: { id: true, firstName: true, lastName: true } }, advisor: { select: { id: true, name: true, role: true } }, reviewer: { select: { id: true, name: true, role: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const reviewType = typeof body.reviewType === "string" ? body.reviewType.trim() : ""
    if (!reviewType) return fail("VALIDATION_ERROR", "Le type de revue est requis.", 422)
    const review = await prisma.supervisionReview.create({
      data: {
        organizationId,
        clientId: typeof body.clientId === "string" ? body.clientId : null,
        advisorId: typeof body.advisorId === "string" ? body.advisorId : null,
        reviewerId: typeof body.reviewerId === "string" ? body.reviewerId : userId,
        reviewType,
        riskLevel: typeof body.riskLevel === "string" ? body.riskLevel : "MEDIUM",
        findings: typeof body.findings === "string" ? body.findings : null,
        requiredCorrections: typeof body.requiredCorrections === "string" ? body.requiredCorrections : null,
        linkedEntityType: typeof body.linkedEntityType === "string" ? body.linkedEntityType : null,
        linkedEntityId: typeof body.linkedEntityId === "string" ? body.linkedEntityId : null,
      },
    })
    await createComplianceEvent({ organizationId, userId, clientId: review.clientId, eventCategory: "SUPERVISION", eventTitle: `Revue supervision ${review.reviewType}`, description: review.requiredCorrections ?? review.findings, severity: review.riskLevel, assignedToId: review.reviewerId, linkedEntityType: "SupervisionReview", linkedEntityId: review.id })
    return ok(review, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
