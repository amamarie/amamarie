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
    const records = await prisma.amlBeneficialOwnershipRecord.findMany({
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
    const direct = typeof body.directOwnershipPercentage === "number" || typeof body.directOwnershipPercentage === "string" ? Number(body.directOwnershipPercentage) : undefined
    const indirect = typeof body.indirectOwnershipPercentage === "number" || typeof body.indirectOwnershipPercentage === "string" ? Number(body.indirectOwnershipPercentage) : undefined
    const record = await prisma.amlBeneficialOwnershipRecord.create({
      data: {
        organizationId,
        clientId: id,
        amlProfileId: profile.id,
        entityName: typeof body.entityName === "string" ? body.entityName : "Entité cliente",
        entityType: typeof body.entityType === "string" ? body.entityType : "CORPORATION",
        directOwnerName: typeof body.directOwnerName === "string" ? body.directOwnerName : null,
        ultimateBeneficialOwnerName: typeof body.ultimateBeneficialOwnerName === "string" ? body.ultimateBeneficialOwnerName : "Bénéficiaire effectif",
        directOwnershipPercentage: Number.isFinite(direct) ? direct : undefined,
        indirectOwnershipPercentage: Number.isFinite(indirect) ? indirect : undefined,
        controlWithoutOwnership: Boolean(body.controlWithoutOwnership),
        controlType: typeof body.controlType === "string" ? body.controlType : null,
        isBeneficialOwner: body.isBeneficialOwner !== false,
        identityVerified: Boolean(body.identityVerified),
        verificationMethod: typeof body.verificationMethod === "string" ? body.verificationMethod : "CLIENT_CONFIRMATION",
        documentId: typeof body.documentId === "string" ? body.documentId : null,
        sourceOfConfirmation: typeof body.sourceOfConfirmation === "string" ? body.sourceOfConfirmation : "Registre ou attestation client",
        officialRegistryMismatch: Boolean(body.officialRegistryMismatch),
        confirmedAt: body.confirmed === false ? null : new Date(),
        confirmedById: body.confirmed === false ? null : userId,
        notes: typeof body.notes === "string" ? body.notes : null,
      },
    })
    await createAuditLog({
      organizationId,
      userId,
      clientId: id,
      entityType: "AmlBeneficialOwnershipRecord",
      entityId: record.id,
      action: "AML_BUSINESS_ENTITY_BENEFICIAL_OWNER_RECORDED",
      newValue: { ultimateBeneficialOwnerName: record.ultimateBeneficialOwnerName },
      sensitivityLevel: "HIGH",
      request,
    })
    await recalculateAmlRisk({ organizationId, clientId: id, userId, request })
    return ok({ record })
  } catch (error) {
    return handleApiError(error)
  }
}
