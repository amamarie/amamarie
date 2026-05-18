import { fail, handleApiError, ok } from "@/lib/api-response"
import { createComplaint } from "@/lib/compliance/center"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get("clientId")
    return ok(await prisma.complaint.findMany({
      where: { organizationId, ...(clientId ? { clientId } : {}) },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        advisor: { select: { id: true, name: true, role: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
      },
      orderBy: { receivedAt: "desc" },
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
    const clientId = typeof body.clientId === "string" ? body.clientId : ""
    const description = typeof body.description === "string" ? body.description.trim() : ""
    if (!clientId || !description) return fail("VALIDATION_ERROR", "Le client et la description sont requis.", 422)
    const complaint = await createComplaint({
      organizationId,
      userId,
      clientId,
      advisorId: typeof body.advisorId === "string" ? body.advisorId : null,
      assignedToId: typeof body.assignedToId === "string" ? body.assignedToId : userId,
      channel: typeof body.channel === "string" ? body.channel : null,
      productType: typeof body.productType === "string" ? body.productType : null,
      category: typeof body.category === "string" ? body.category : null,
      description,
      severity: typeof body.severity === "string" ? body.severity : "MEDIUM",
      reportableToAmf: Boolean(body.reportableToAmf),
      documents: body.documents,
    })
    return ok(complaint, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
