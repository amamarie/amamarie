import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createAuditLog } from "@/lib/compliance/audit"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string; goalId: string }> }

const optionalNumber = z.preprocess((value) => {
  if (value === "" || value === null || typeof value === "undefined") return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}, z.number().min(0).optional())

const updateGoalSchema = z.object({
  goalName: z.string().trim().min(1).optional(),
  goalType: z.string().trim().min(1).optional(),
  priority: z.string().trim().min(1).optional(),
  targetAmount: optionalNumber,
  currentAmount: optionalNumber,
  timeHorizonYears: optionalNumber,
  liquidityNeed: z.string().trim().optional(),
  riskLevelForGoal: z.string().trim().optional(),
  accountId: z.string().trim().optional(),
  contributionPlan: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

function cleanOptionalText(value?: string) {
  return value && value.trim().length > 0 ? value.trim() : null
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id, goalId } = await params
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    if (!["OWNER", "ADVISOR", "ASSISTANT", "COMPLIANCE", "DEVELOPER"].includes(user.role)) return fail("FORBIDDEN", "Accès refusé.", 403)
    const { organizationId } = await getTenantContext()
    const existing = await prisma.financialGoal.findFirst({ where: { id: goalId, clientId: id, organizationId } })
    if (!existing) return fail("NOT_FOUND", "Objectif introuvable.", 404)
    const payload = updateGoalSchema.parse(await request.json())
    const goal = await prisma.financialGoal.update({
      where: { id: goalId },
      data: {
        ...(payload.goalName !== undefined ? { goalName: payload.goalName } : {}),
        ...(payload.goalType !== undefined ? { goalType: payload.goalType } : {}),
        ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
        ...(payload.targetAmount !== undefined ? { targetAmount: payload.targetAmount } : {}),
        ...(payload.currentAmount !== undefined ? { currentAmount: payload.currentAmount } : {}),
        ...(payload.timeHorizonYears !== undefined ? { timeHorizonYears: payload.timeHorizonYears } : {}),
        ...(payload.liquidityNeed !== undefined ? { liquidityNeed: cleanOptionalText(payload.liquidityNeed) } : {}),
        ...(payload.riskLevelForGoal !== undefined ? { riskLevelForGoal: cleanOptionalText(payload.riskLevelForGoal) } : {}),
        ...(payload.accountId !== undefined ? { accountId: cleanOptionalText(payload.accountId) } : {}),
        ...(payload.contributionPlan !== undefined ? { contributionPlan: cleanOptionalText(payload.contributionPlan) } : {}),
        ...(payload.notes !== undefined ? { notes: cleanOptionalText(payload.notes) } : {}),
        lastReviewedAt: new Date(),
      },
    })
    await createAuditLog({
      organizationId,
      userId: user.id,
      clientId: id,
      entityType: "FinancialGoal",
      entityId: goal.id,
      action: "KYC_FINANCIAL_GOAL_UPDATED",
      oldValue: existing,
      newValue: goal,
    })
    return ok(goal)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id, goalId } = await params
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    if (!["OWNER", "ADVISOR", "COMPLIANCE", "DEVELOPER"].includes(user.role)) return fail("FORBIDDEN", "Accès refusé.", 403)
    const { organizationId } = await getTenantContext()
    const existing = await prisma.financialGoal.findFirst({ where: { id: goalId, clientId: id, organizationId } })
    if (!existing) return fail("NOT_FOUND", "Objectif introuvable.", 404)
    await prisma.financialGoal.delete({ where: { id: goalId } })
    await createAuditLog({
      organizationId,
      userId: user.id,
      clientId: id,
      entityType: "FinancialGoal",
      entityId: goalId,
      action: "KYC_FINANCIAL_GOAL_DELETED",
      oldValue: existing,
    })
    return ok({ deleted: true })
  } catch (error) {
    return handleApiError(error)
  }
}
