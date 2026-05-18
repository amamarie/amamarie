import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { createComplianceEvent } from "@/lib/compliance/center"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const linkedEntityType = searchParams.get("linkedEntityType")
    const linkedEntityId = searchParams.get("linkedEntityId")
    return ok(await prisma.complianceApprovalStep.findMany({
      where: {
        organizationId,
        ...(linkedEntityType ? { linkedEntityType } : {}),
        ...(linkedEntityId ? { linkedEntityId } : {}),
      },
      orderBy: [{ status: "asc" }, { level: "asc" }, { createdAt: "asc" }],
      take: 300,
    }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const linkedEntityType = typeof body.linkedEntityType === "string" ? body.linkedEntityType : ""
    const linkedEntityId = typeof body.linkedEntityId === "string" ? body.linkedEntityId : ""
    const title = typeof body.title === "string" ? body.title : ""
    if (!linkedEntityType || !linkedEntityId || !title) return fail("VALIDATION_ERROR", "Entité liée et titre requis.", 422)
    const steps = Array.isArray(body.steps) && body.steps.length > 0 ? body.steps : [{ level: 1, title }]
    const created = await prisma.$transaction(steps.map((step: Record<string, unknown>, index: number) => prisma.complianceApprovalStep.create({
      data: {
        organizationId,
        linkedEntityType,
        linkedEntityId,
        clientId: typeof body.clientId === "string" ? body.clientId : null,
        advisorId: typeof body.advisorId === "string" ? body.advisorId : null,
        requestedById: userId,
        level: Number(step.level ?? index + 1),
        title: typeof step.title === "string" ? step.title : `${title} - niveau ${index + 1}`,
        requiredRole: typeof step.requiredRole === "string" ? step.requiredRole : null,
        dueAt: step.dueAt ? new Date(String(step.dueAt)) : null,
      },
    })))
    await createComplianceEvent({
      organizationId,
      userId,
      clientId: typeof body.clientId === "string" ? body.clientId : null,
      eventCategory: "APPROVAL",
      eventTitle: `Approbation multi-niveaux demandée - ${title}`,
      description: `${created.length} niveau(x) d’approbation créé(s).`,
      severity: "IMPORTANT",
      linkedEntityType,
      linkedEntityId,
    })
    await createAuditLog({
      organizationId,
      userId,
      clientId: typeof body.clientId === "string" ? body.clientId : null,
      entityType: linkedEntityType,
      entityId: linkedEntityId,
      action: "MULTI_LEVEL_APPROVAL_REQUESTED",
      newValue: { steps: created.length, title },
      source: "api",
      sensitivityLevel: "HIGH",
      request,
    })
    return ok(created, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
