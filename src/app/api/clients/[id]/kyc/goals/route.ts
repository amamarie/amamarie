import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

const optionalNumber = z.preprocess((value) => {
  if (value === "" || value === null || typeof value === "undefined") return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}, z.number().min(0).optional())

const goalSchema = z.object({
  goalName: z.string().trim().min(1, "Le nom de l’objectif est requis."),
  goalType: z.string().trim().min(1).default("OTHER"),
  priority: z.string().trim().min(1).default("MEDIUM"),
  targetAmount: optionalNumber,
  currentAmount: optionalNumber,
  timeHorizonYears: optionalNumber,
  liquidityNeed: z.string().trim().optional(),
  riskLevelForGoal: z.string().trim().optional(),
  accountId: z.string().trim().optional(),
  contributionPlan: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const goals = await prisma.financialGoal.findMany({
      where: { organizationId, clientId: id },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    })
    return ok(goals)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    if (!["OWNER", "ADVISOR", "ASSISTANT", "COMPLIANCE", "DEVELOPER"].includes(user.role)) return fail("FORBIDDEN", "Accès refusé.", 403)
    const { organizationId } = await getTenantContext()
    const client = await prisma.client.findFirst({
      where: { id, organizationId },
      include: { kycProfile: true },
    })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    const payload = goalSchema.parse(await request.json())
    const goal = await prisma.financialGoal.create({
      data: {
        organizationId,
        clientId: id,
        kycProfileId: client.kycProfile?.id,
        goalName: payload.goalName,
        goalType: payload.goalType,
        priority: payload.priority,
        targetAmount: payload.targetAmount,
        currentAmount: payload.currentAmount,
        timeHorizonYears: payload.timeHorizonYears,
        liquidityNeed: payload.liquidityNeed || null,
        riskLevelForGoal: payload.riskLevelForGoal || null,
        accountId: payload.accountId || null,
        contributionPlan: payload.contributionPlan || null,
        notes: payload.notes || null,
        source: "ADVISOR",
        lastReviewedAt: new Date(),
      },
    })
    await createAuditLog({
      organizationId,
      userId: user.id,
      clientId: id,
      entityType: "FinancialGoal",
      entityId: goal.id,
      action: "KYC_FINANCIAL_GOAL_CREATED",
      newValue: goal,
    })
    return ok(goal, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
