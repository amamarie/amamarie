import { handleApiError, ok } from "@/lib/api-response"
import { ensureAmlProfile, recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const profile = await ensureAmlProfile({ organizationId, clientId: id, userId, request })
    const client = await prisma.client.findFirst({ where: { id, organizationId }, select: { firstName: true, lastName: true } })
    const result = typeof body.result === "string" ? body.result : "NO_MATCH"
    const record = await prisma.amlPepScreening.create({
      data: {
        organizationId,
        clientId: id,
        amlProfileId: profile.id,
        screenedPersonName: typeof body.screenedPersonName === "string" ? body.screenedPersonName : `${client?.firstName ?? ""} ${client?.lastName ?? ""}`.trim(),
        screeningType: typeof body.screeningType === "string" ? body.screeningType : "CLIENT",
        result,
        pepType: typeof body.pepType === "string" ? body.pepType : null,
        positionTitle: typeof body.positionTitle === "string" ? body.positionTitle : null,
        organizationName: typeof body.organizationName === "string" ? body.organizationName : null,
        country: typeof body.country === "string" ? body.country : null,
        relationshipToClient: typeof body.relationshipToClient === "string" ? body.relationshipToClient : null,
        sourceOfFundsRequired: Boolean(body.sourceOfFundsRequired || result === "POSITIVE"),
        sourceOfWealthRequired: Boolean(body.sourceOfWealthRequired || result === "POSITIVE"),
        seniorManagementReviewRequired: Boolean(body.seniorManagementReviewRequired || result === "POSITIVE"),
        reviewedById: result === "NO_MATCH" || body.reviewed ? userId : null,
        reviewedAt: result === "NO_MATCH" || body.reviewed ? new Date() : null,
        notes: typeof body.notes === "string" ? body.notes : null,
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      clientId: id,
      entityType: "AmlPepScreening",
      entityId: record.id,
      action: "AML_PEP_SCREENING_CREATED",
      newValue: { result: record.result, pepType: record.pepType, reviewedAt: record.reviewedAt },
      source: "advisor",
      sensitivityLevel: "HIGH",
      request,
    })
    await recalculateAmlRisk({ organizationId, clientId: id, userId, request })
    return ok({ record })
  } catch (error) {
    return handleApiError(error)
  }
}
