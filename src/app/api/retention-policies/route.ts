import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    return ok(await prisma.retentionPolicy.findMany({ where: { organizationId }, include: { approvedBy: { select: { id: true, name: true } } }, orderBy: [{ active: "desc" }, { dataCategory: "asc" }] }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const policy = await prisma.retentionPolicy.create({
      data: {
        organizationId,
        createdById: userId,
        dataCategory: String(body.dataCategory ?? "CLIENT_DATA"),
        documentType: typeof body.documentType === "string" ? body.documentType : null,
        retentionPeriodMonths: Number(body.retentionPeriodMonths ?? 84),
        triggerEvent: String(body.triggerEvent ?? "CREATION"),
        actionAtEnd: String(body.actionAtEnd ?? "REVIEW"),
        requiresApproval: body.requiresApproval !== false,
        notes: typeof body.notes === "string" ? body.notes : null,
      },
    })
    await createAuditLog({ organizationId, userId, entityType: "RetentionPolicy", entityId: policy.id, action: "RETENTION_POLICY_CREATED", newValue: { dataCategory: policy.dataCategory, retentionPeriodMonths: policy.retentionPeriodMonths } })
    return ok(policy, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
