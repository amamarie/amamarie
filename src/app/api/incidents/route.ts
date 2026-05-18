import { fail, handleApiError, ok } from "@/lib/api-response"
import { createComplianceIncident } from "@/lib/compliance/center"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId")
    return ok(await prisma.complianceIncident.findMany({
      where: { organizationId, ...(clientId ? { clientId } : {}) },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        detectedBy: { select: { id: true, name: true, role: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
      },
      orderBy: { detectedAt: "desc" },
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
    const incidentType = typeof body.incidentType === "string" ? body.incidentType.trim() : ""
    const description = typeof body.description === "string" ? body.description.trim() : ""
    if (!incidentType || !description) return fail("VALIDATION_ERROR", "Le type et la description sont requis.", 422)
    const incident = await createComplianceIncident({
      organizationId,
      userId,
      clientId: typeof body.clientId === "string" ? body.clientId : null,
      assignedToId: typeof body.assignedToId === "string" ? body.assignedToId : userId,
      incidentType,
      description,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : null,
      affectedClientIds: body.affectedClientIds,
      dataCategories: body.dataCategories,
      riskLevel: typeof body.riskLevel === "string" ? body.riskLevel : "TO_ASSESS",
      seriousHarmRisk: Boolean(body.seriousHarmRisk),
      mitigationSteps: typeof body.mitigationSteps === "string" ? body.mitigationSteps : null,
    })
    return ok(incident, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
