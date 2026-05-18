import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const current = await prisma.complianceException.findFirst({ where: { id, organizationId } })
    if (!current) return fail("NOT_FOUND", "Exception introuvable.", 404)
    const approvalSteps = await prisma.complianceApprovalStep.findMany({
      where: { organizationId, linkedEntityType: "ComplianceException", linkedEntityId: id },
      orderBy: { level: "asc" },
    })
    const rejectedStep = approvalSteps.find((step) => step.status === "REJECTED")
    if (rejectedStep) {
      return fail("APPROVAL_REJECTED", "Cette exception a été refusée dans le workflow d’approbation.", 409)
    }
    const pendingStep = approvalSteps.find((step) => step.status !== "APPROVED")
    if (pendingStep) {
      return fail("APPROVAL_REQUIRED", "Toutes les étapes d’approbation multi-niveaux doivent être complétées avant l’approbation finale.", 409)
    }
    const exception = await prisma.complianceException.update({ where: { id }, data: { status: "APPROVED", approvedById: userId, approvedAt: new Date() } })
    await createAuditLog({ organizationId, userId, clientId: current.clientId, entityType: "ComplianceException", entityId: id, action: "COMPLIANCE_EXCEPTION_APPROVED", oldValue: { status: current.status }, newValue: { status: exception.status, approvalSteps: approvalSteps.length }, source: "api", sensitivityLevel: "HIGH" })
    return ok(exception)
  } catch (error) {
    return handleApiError(error)
  }
}
