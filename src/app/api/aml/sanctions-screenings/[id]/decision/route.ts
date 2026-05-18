import { fail, handleApiError, ok } from "@/lib/api-response"
import { recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const screening = await prisma.amlSanctionsScreening.findFirst({ where: { id, organizationId } })
    if (!screening) return fail("NOT_FOUND", "Screening sanctions introuvable.", 404)

    const decision = typeof body.decision === "string" ? body.decision : "FALSE_POSITIVE"
    const result = decision === "CONFIRMED" ? "CONFIRMED_MATCH" : decision === "FALSE_POSITIVE" ? "NO_MATCH" : screening.result
    const updated = await prisma.amlSanctionsScreening.update({
      where: { id },
      data: {
        decision,
        result,
        decisionReason: typeof body.decisionReason === "string" ? body.decisionReason : "Décision conformité documentée.",
        decidedById: userId,
        decidedAt: new Date(),
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      clientId: screening.clientId,
      entityType: "AmlSanctionsScreening",
      entityId: screening.id,
      action: "AML_SANCTIONS_DECISION_RECORDED",
      oldValue: { result: screening.result, decision: screening.decision },
      newValue: { result: updated.result, decision: updated.decision, decisionReason: updated.decisionReason },
      source: "advisor",
      sensitivityLevel: "HIGH",
      request,
    })

    const profile = await recalculateAmlRisk({ organizationId, clientId: screening.clientId, userId, request })
    return ok({ screening: updated, profile })
  } catch (error) {
    return handleApiError(error)
  }
}
