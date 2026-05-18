import { prisma } from "@/lib/prisma"
import { randomUUID } from "crypto"

export async function logAIUsage({
  organizationId,
  userId,
  feature,
  model,
  status,
  inputHash,
  error,
}: {
  organizationId: string
  userId?: string | null
  feature: string
  model: string
  status: "SUCCESS" | "FAILED" | "CACHED"
  inputHash?: string
  error?: string
}) {
  try {
    const id = randomUUID()
    await prisma.$executeRaw`
      INSERT INTO "AiUsageLog" ("id", "organizationId", "userId", "feature", "model", "status", "inputHash", "error", "createdAt")
      VALUES (${id}, ${organizationId}, ${userId ?? null}, ${feature}, ${model}, ${status}, ${inputHash ?? null}, ${error ?? null}, NOW())
    `
  } catch {
    // Usage tracking must never block the CRM workflow.
  }
}
