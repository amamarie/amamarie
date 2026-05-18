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
    const records = await prisma.amlSourceOfFundsRecord.findMany({
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
    const amount = typeof body.amount === "number" || typeof body.amount === "string" ? Number(body.amount) : undefined
    const validated = body.validated !== false

    const record = await prisma.amlSourceOfFundsRecord.create({
      data: {
        organizationId,
        clientId: id,
        amlProfileId: profile.id,
        transactionId: typeof body.transactionId === "string" ? body.transactionId : null,
        operationType: typeof body.operationType === "string" ? body.operationType : "OPERATION",
        sourceType: typeof body.sourceType === "string" ? body.sourceType : "SAVINGS",
        amount: Number.isFinite(amount) ? amount : undefined,
        currency: typeof body.currency === "string" ? body.currency : "CAD",
        originCountry: typeof body.originCountry === "string" ? body.originCountry : "Canada",
        financialInstitution: typeof body.financialInstitution === "string" ? body.financialInstitution : null,
        thirdPartyFunds: Boolean(body.thirdPartyFunds),
        documentId: typeof body.documentId === "string" ? body.documentId : null,
        coherentWithKyc: typeof body.coherentWithKyc === "string" ? body.coherentWithKyc : "YES",
        validatedById: validated ? userId : null,
        validatedAt: validated ? new Date() : null,
        riskLevel: typeof body.riskLevel === "string" ? body.riskLevel : "LOW",
        notes: typeof body.notes === "string" ? body.notes : null,
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      clientId: id,
      entityType: "AmlSourceOfFundsRecord",
      entityId: record.id,
      action: "AML_SOURCE_OF_FUNDS_RECORDED",
      newValue: { sourceType: record.sourceType, amount: record.amount?.toString(), validatedAt: record.validatedAt },
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
