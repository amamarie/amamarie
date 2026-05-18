import { fail, handleApiError, ok } from "@/lib/api-response"
import { ensureAmlProfile, recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const records = await prisma.amlIdentityVerification.findMany({
      where: { organizationId, clientId: id },
      orderBy: { createdAt: "desc" },
    })
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
    if (!profile) return fail("NOT_FOUND", "Profil AML introuvable.", 404)

    const result = typeof body.result === "string" ? body.result : "PASSED"
    const record = await prisma.amlIdentityVerification.create({
      data: {
        organizationId,
        clientId: id,
        amlProfileId: profile.id,
        reason: typeof body.reason === "string" ? body.reason : "Nouvelle relation ou opération AML",
        personType: typeof body.personType === "string" ? body.personType : "INDIVIDUAL",
        method: typeof body.method === "string" ? body.method : "DOCUMENT_REVIEW",
        provider: typeof body.provider === "string" ? body.provider : null,
        documentType: typeof body.documentType === "string" ? body.documentType : null,
        documentId: typeof body.documentId === "string" ? body.documentId : null,
        issuingJurisdiction: typeof body.issuingJurisdiction === "string" ? body.issuingJurisdiction : null,
        result,
        verifiedById: userId,
        verifiedAt: result === "PASSED" ? new Date() : null,
        notes: typeof body.notes === "string" ? body.notes : null,
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      clientId: id,
      entityType: "AmlIdentityVerification",
      entityId: record.id,
      action: "AML_IDENTITY_VERIFICATION_CREATED",
      newValue: { result: record.result, method: record.method, reason: record.reason },
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
