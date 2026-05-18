import { prisma } from "@/lib/prisma"

import type { AlertExplanationContext } from "./types"

function calculateAge(dateOfBirth: Date | null) {
  if (!dateOfBirth) return null
  const today = new Date()
  let age = today.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = today.getMonth() - dateOfBirth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age -= 1
  }
  return age
}

export async function buildAlertExplanationContext({
  organizationId,
  alertId,
}: {
  organizationId: string
  alertId: string
  userId: string
}): Promise<AlertExplanationContext> {
  const alert = await prisma.complianceAlert.findFirst({
    where: { id: alertId, organizationId },
    include: {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          status: true,
          dateOfBirth: true,
          familyStatus: true,
          dependentsCount: true,
          dependents: true,
          riskProfile: true,
          financialGoals: true,
          lastContactAt: true,
          updatedAt: true,
          kycProfile: {
            select: {
              status: true,
              sourceOfFunds: true,
              primaryObjective: true,
              riskProfileResult: true,
              complianceScore: true,
              updatedAt: true,
            },
          },
          products: {
            select: {
              id: true,
              category: true,
              type: true,
              status: true,
              renewalAt: true,
              lastReviewAt: true,
              primaryBeneficiary: true,
              documentStatus: true,
              updatedAt: true,
            },
            take: 12,
          },
          documents: {
            select: {
              id: true,
              type: true,
              status: true,
              updatedAt: true,
            },
            take: 12,
          },
          tasks: {
            where: { status: { in: ["TODO", "IN_PROGRESS", "OVERDUE"] } },
            select: {
              id: true,
              title: true,
              priority: true,
              dueDate: true,
              updatedAt: true,
            },
            take: 8,
            orderBy: { dueDate: "asc" },
          },
        },
      },
    },
  })

  if (!alert) {
    throw new Error("ALERT_NOT_FOUND")
  }

  return {
    alert: {
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      description: alert.description,
      actionLabel: alert.actionLabel,
      updatedAt: alert.updatedAt,
    },
    client: {
      id: alert.client.id,
      firstName: alert.client.firstName,
      lastName: alert.client.lastName,
      status: alert.client.status,
      age: calculateAge(alert.client.dateOfBirth),
      familyStatus: alert.client.familyStatus,
      dependentsCount: alert.client.dependentsCount ?? alert.client.dependents,
      riskProfile: alert.client.riskProfile,
      financialGoals: alert.client.financialGoals,
      lastContactAt: alert.client.lastContactAt,
      updatedAt: alert.client.updatedAt,
    },
    kyc: alert.client.kycProfile,
    products: alert.client.products.map((product) => ({
      ...product,
      category: product.category,
      type: product.type,
      status: product.status,
    })),
    documents: alert.client.documents,
    openTasks: alert.client.tasks.map((task) => ({
      ...task,
      priority: task.priority,
    })),
  }
}
