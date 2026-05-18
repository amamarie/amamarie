import { handleApiError, ok } from "@/lib/api-response"
import { ensureAmlProfile, recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const records = await prisma.amlThirdPartyDetermination.findMany({ where: { organizationId, clientId: id }, orderBy: { createdAt: "desc" } })
    return ok({ records })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const profile = await ensureAmlProfile({ organizationId, clientId: id, userId, request })
    const involved = Boolean(body.thirdPartyInvolved)

    const record = await prisma.amlThirdPartyDetermination.create({
      data: {
        organizationId,
        clientId: id,
        amlProfileId: profile.id,
        transactionId: typeof body.transactionId === "string" ? body.transactionId : null,
        thirdPartyInvolved: involved,
        thirdPartySuspected: Boolean(body.thirdPartySuspected),
        thirdPartyName: typeof body.thirdPartyName === "string" ? body.thirdPartyName : null,
        thirdPartyType: typeof body.thirdPartyType === "string" ? body.thirdPartyType : null,
        relationshipToClient: typeof body.relationshipToClient === "string" ? body.relationshipToClient : null,
        role: typeof body.role === "string" ? body.role : null,
        identityVerified: Boolean(body.identityVerified),
        sourceOfFunds: typeof body.sourceOfFunds === "string" ? body.sourceOfFunds : null,
        documentId: typeof body.documentId === "string" ? body.documentId : null,
        determinationMethod: typeof body.determinationMethod === "string" ? body.determinationMethod : "CLIENT_ATTESTATION",
        riskLevel: typeof body.riskLevel === "string" ? body.riskLevel : involved ? "MEDIUM" : "LOW",
        complianceReviewRequired: Boolean(body.complianceReviewRequired),
        notes: typeof body.notes === "string" ? body.notes : null,
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      clientId: id,
      entityType: "AmlThirdPartyDetermination",
      entityId: record.id,
      action: "AML_THIRD_PARTY_DETERMINED",
      newValue: { thirdPartyInvolved: record.thirdPartyInvolved, thirdPartyName: record.thirdPartyName, identityVerified: record.identityVerified },
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
