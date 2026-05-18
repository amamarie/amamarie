import { fail, handleApiError, ok } from "@/lib/api-response"
import { createComplianceEvent } from "@/lib/compliance/center"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    return ok(await prisma.complianceException.findMany({
      where: { organizationId },
      include: { client: { select: { id: true, firstName: true, lastName: true } }, advisor: { select: { id: true, name: true, role: true } }, requestedBy: { select: { id: true, name: true, role: true } }, approvedBy: { select: { id: true, name: true, role: true } } },
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
    const exceptionType = typeof body.exceptionType === "string" ? body.exceptionType.trim() : ""
    const reason = typeof body.reason === "string" ? body.reason.trim() : ""
    if (!exceptionType || !reason) return fail("VALIDATION_ERROR", "Le type d’exception et la raison sont requis.", 422)
    const exception = await prisma.complianceException.create({
      data: {
        organizationId,
        clientId: typeof body.clientId === "string" ? body.clientId : null,
        advisorId: typeof body.advisorId === "string" ? body.advisorId : null,
        requestedById: userId,
        exceptionType,
        reason,
        riskLevel: typeof body.riskLevel === "string" ? body.riskLevel : "MEDIUM",
        supportingDocumentId: typeof body.supportingDocumentId === "string" ? body.supportingDocumentId : null,
        linkedEntityType: typeof body.linkedEntityType === "string" ? body.linkedEntityType : null,
        linkedEntityId: typeof body.linkedEntityId === "string" ? body.linkedEntityId : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    })
    await createComplianceEvent({ organizationId, userId, clientId: exception.clientId, eventCategory: "EXCEPTION", eventTitle: `Exception demandée - ${exception.exceptionType}`, description: reason, severity: exception.riskLevel, linkedEntityType: "ComplianceException", linkedEntityId: exception.id })
    if (["HIGH", "CRITICAL"].includes(exception.riskLevel)) {
      await prisma.complianceApprovalStep.createMany({
        data: [
          {
            organizationId,
            linkedEntityType: "ComplianceException",
            linkedEntityId: exception.id,
            clientId: exception.clientId,
            advisorId: exception.advisorId,
            requestedById: userId,
            level: 1,
            title: "Révision conformité",
            requiredRole: "COMPLIANCE",
          },
          {
            organizationId,
            linkedEntityType: "ComplianceException",
            linkedEntityId: exception.id,
            clientId: exception.clientId,
            advisorId: exception.advisorId,
            requestedById: userId,
            level: 2,
            title: "Approbation direction",
            requiredRole: "MANAGER",
          },
        ],
      })
      await createComplianceEvent({
        organizationId,
        userId,
        clientId: exception.clientId,
        eventCategory: "APPROVAL",
        eventTitle: "Approbation multi-niveaux requise",
        description: "Exception à risque élevé: approbation conformité puis direction requise avant approbation finale.",
        severity: "IMPORTANT",
        linkedEntityType: "ComplianceException",
        linkedEntityId: exception.id,
      })
    }
    return ok(exception, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
