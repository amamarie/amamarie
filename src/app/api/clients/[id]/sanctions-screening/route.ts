import { handleApiError, ok } from "@/lib/api-response"
import { ensureAmlProfile, recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const profile = await ensureAmlProfile({ organizationId, clientId: id, userId, request })
    const client = await prisma.client.findFirst({ where: { id, organizationId }, select: { firstName: true, lastName: true } })
    const result = typeof body.result === "string" ? body.result : "NO_MATCH"
    const decision = typeof body.decision === "string" ? body.decision : result === "NO_MATCH" ? "CLEARED" : "PENDING"
    const score = typeof body.matchScore === "number" || typeof body.matchScore === "string" ? Number(body.matchScore) : undefined

    const record = await prisma.amlSanctionsScreening.create({
      data: {
        organizationId,
        clientId: id,
        amlProfileId: profile.id,
        screenedEntityType: typeof body.screenedEntityType === "string" ? body.screenedEntityType : "CLIENT",
        screenedEntityId: typeof body.screenedEntityId === "string" ? body.screenedEntityId : id,
        nameScreened: typeof body.nameScreened === "string" ? body.nameScreened : `${client?.firstName ?? ""} ${client?.lastName ?? ""}`.trim(),
        aliasesScreened: Array.isArray(body.aliasesScreened) ? body.aliasesScreened : undefined,
        listsUsed: Array.isArray(body.listsUsed) ? body.listsUsed : ["CANADA_CONSOLIDATED", "UN_CONSOLIDATED"],
        provider: typeof body.provider === "string" ? body.provider : "MANUAL",
        result,
        matchScore: Number.isFinite(score) ? score : undefined,
        matchedName: typeof body.matchedName === "string" ? body.matchedName : null,
        matchedList: typeof body.matchedList === "string" ? body.matchedList : null,
        matchType: typeof body.matchType === "string" ? body.matchType : null,
        decision,
        decisionReason: typeof body.decisionReason === "string" ? body.decisionReason : null,
        decidedById: decision !== "PENDING" ? userId : null,
        decidedAt: decision !== "PENDING" ? new Date() : null,
        nextReviewAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })

    await createAuditLog({
      organizationId,
      userId,
      clientId: id,
      entityType: "AmlSanctionsScreening",
      entityId: record.id,
      action: "AML_SANCTIONS_SCREENING_CREATED",
      newValue: { result: record.result, decision: record.decision, matchedList: record.matchedList },
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
