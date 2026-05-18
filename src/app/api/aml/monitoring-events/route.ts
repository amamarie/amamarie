import { handleApiError, ok } from "@/lib/api-response"
import { createAmlMonitoringEvent } from "@/lib/aml/service"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    const events = await prisma.amlMonitoringEvent.findMany({
      where: { organizationId },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    return ok({ events })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    if (typeof body.clientId !== "string") {
      return Response.json({ ok: false, error: { code: "VALIDATION_ERROR", message: "clientId requis." } }, { status: 422 })
    }
    const event = await createAmlMonitoringEvent({
      organizationId,
      userId,
      clientId: body.clientId,
      eventType: typeof body.eventType === "string" ? body.eventType : "MANUAL_REVIEW",
      eventTitle: typeof body.eventTitle === "string" ? body.eventTitle : "Événement de surveillance AML",
      description: typeof body.description === "string" ? body.description : null,
      sourceEntityType: typeof body.sourceEntityType === "string" ? body.sourceEntityType : null,
      sourceEntityId: typeof body.sourceEntityId === "string" ? body.sourceEntityId : null,
      amount: typeof body.amount === "number" ? body.amount : null,
      currency: typeof body.currency === "string" ? body.currency : "CAD",
      country: typeof body.country === "string" ? body.country : null,
      triggerRuleKey: typeof body.triggerRuleKey === "string" ? body.triggerRuleKey : "aml.monitoring.event",
      riskImpact: typeof body.riskImpact === "number" ? body.riskImpact : 0,
      metadata: body.metadata,
      request,
    })
    return ok({ event })
  } catch (error) {
    return handleApiError(error)
  }
}
