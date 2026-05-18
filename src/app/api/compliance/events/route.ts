import { fail, handleApiError, ok } from "@/lib/api-response"
import { createComplianceEvent } from "@/lib/compliance/center"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId")
    const status = searchParams.get("status")
    const category = searchParams.get("category")
    return ok(await prisma.complianceEvent.findMany({
      where: {
        organizationId,
        ...(clientId ? { clientId } : {}),
        ...(status ? { status } : {}),
        ...(category ? { eventCategory: category } : {}),
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, name: true, role: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
        resolvedBy: { select: { id: true, name: true, role: true } },
      },
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
    const eventTitle = typeof body.eventTitle === "string" ? body.eventTitle.trim() : ""
    const eventCategory = typeof body.eventCategory === "string" ? body.eventCategory.trim() : ""
    if (!eventTitle || !eventCategory) return fail("VALIDATION_ERROR", "La catégorie et le titre sont requis.", 422)
    const event = await createComplianceEvent({
      organizationId,
      userId,
      clientId: typeof body.clientId === "string" ? body.clientId : null,
      eventCategory,
      eventTitle,
      description: typeof body.description === "string" ? body.description : null,
      severity: typeof body.severity === "string" ? body.severity : "INFO",
      status: typeof body.status === "string" ? body.status : "OPEN",
      assignedToId: typeof body.assignedToId === "string" ? body.assignedToId : null,
      linkedEntityType: typeof body.linkedEntityType === "string" ? body.linkedEntityType : null,
      linkedEntityId: typeof body.linkedEntityId === "string" ? body.linkedEntityId : null,
      metadata: body.metadata,
    })
    return ok(event, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
