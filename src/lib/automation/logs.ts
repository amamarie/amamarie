import type { AutomationTrigger, Prisma } from "@prisma/client"

import { prisma } from "@/lib/prisma"

export async function startAutomationRun({
  organizationId,
  automationRuleId,
  trigger,
  entityType,
  entityId,
  payload,
}: {
  organizationId: string
  automationRuleId?: string | null
  trigger: AutomationTrigger
  entityType?: string | null
  entityId?: string | null
  payload?: Prisma.InputJsonValue
}) {
  return prisma.automationRun.create({
    data: {
      organizationId,
      automationRuleId,
      trigger,
      entityType,
      entityId,
      status: "RUNNING",
      payload,
    },
  })
}

export async function completeAutomationRun({
  id,
  actionsExecuted,
}: {
  id: string
  actionsExecuted: Prisma.InputJsonValue
}) {
  return prisma.automationRun.update({
    where: { id },
    data: {
      status: "SUCCESS",
      completedAt: new Date(),
      actionsExecuted,
    },
  })
}

export async function failAutomationRun({
  id,
  error,
  actionsExecuted,
}: {
  id: string
  error: string
  actionsExecuted?: Prisma.InputJsonValue
}) {
  return prisma.automationRun.update({
    where: { id },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      error,
      actionsExecuted,
    },
  })
}

