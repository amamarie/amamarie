import { createHash } from "crypto"

import { prisma } from "@/lib/prisma"

import type { AlertExplanationContext } from "./types"

export function createAlertExplanationInputHash(context: AlertExplanationContext) {
  const payload = {
    alert: {
      type: context.alert.type,
      severity: context.alert.severity,
      title: context.alert.title,
      description: context.alert.description,
      updatedAt: context.alert.updatedAt.toISOString(),
    },
    clientUpdatedAt: context.client.updatedAt.toISOString(),
    kycUpdatedAt: context.kyc?.updatedAt.toISOString() ?? null,
    products: context.products.map((product) => ({
      id: product.id,
      status: product.status,
      renewalAt: product.renewalAt?.toISOString() ?? null,
      lastReviewAt: product.lastReviewAt?.toISOString() ?? null,
      primaryBeneficiary: product.primaryBeneficiary,
      documentStatus: product.documentStatus,
      updatedAt: product.updatedAt.toISOString(),
    })),
    documents: context.documents.map((document) => ({
      id: document.id,
      status: document.status,
      updatedAt: document.updatedAt.toISOString(),
    })),
    tasks: context.openTasks.map((task) => ({
      id: task.id,
      priority: task.priority,
      dueDate: task.dueDate?.toISOString() ?? null,
      updatedAt: task.updatedAt.toISOString(),
    })),
  }

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex")
}

export async function findCachedAlertExplanation({
  organizationId,
  alertId,
  inputHash,
}: {
  organizationId: string
  alertId: string
  inputHash: string
}) {
  return prisma.alertAiExplanation.findFirst({
    where: {
      organizationId,
      alertId,
      inputHash,
      status: { in: ["GENERATED", "REVIEWED"] },
    },
    orderBy: { createdAt: "desc" },
  })
}
