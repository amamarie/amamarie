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
    const records = await prisma.amlSourceOfWealthRecord.findMany({ where: { organizationId, clientId: id }, orderBy: { createdAt: "desc" } })
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
    const estimatedWealth = typeof body.estimatedWealth === "number" || typeof body.estimatedWealth === "string" ? Number(body.estimatedWealth) : undefined
    const validated = body.validated !== false

    const record = await prisma.amlSourceOfWealthRecord.create({
      data: {
        organizationId,
        clientId: id,
        amlProfileId: profile.id,
        wealthSourceType: typeof body.wealthSourceType === "string" ? body.wealthSourceType : "EMPLOYMENT",
        description: typeof body.description === "string" ? body.description : null,
        estimatedWealth: Number.isFinite(estimatedWealth) ? estimatedWealth : undefined,
        accumulationYears: typeof body.accumulationYears === "number" ? body.accumulationYears : null,
        documentId: typeof body.documentId === "string" ? body.documentId : null,
        coherentWithKyc: typeof body.coherentWithKyc === "string" ? body.coherentWithKyc : "YES",
        validatedById: validated ? userId : null,
        validatedAt: validated ? new Date() : null,
        notes: typeof body.notes === "string" ? body.notes : null,
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      clientId: id,
      entityType: "AmlSourceOfWealthRecord",
      entityId: record.id,
      action: "AML_SOURCE_OF_WEALTH_RECORDED",
      newValue: { wealthSourceType: record.wealthSourceType, estimatedWealth: record.estimatedWealth?.toString(), validatedAt: record.validatedAt },
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
