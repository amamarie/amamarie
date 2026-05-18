import { handleApiError, ok } from "@/lib/api-response"
import { ensureAmlProfile, recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const clients = await prisma.client.findMany({
      where: { organizationId, amlProfile: null },
      select: { id: true },
      take: 500,
    })
    const processed: string[] = []
    for (const client of clients) {
      await ensureAmlProfile({ organizationId, clientId: client.id, userId, request })
      await recalculateAmlRisk({ organizationId, clientId: client.id, userId, request })
      processed.push(client.id)
    }
    await createAuditLog({
      organizationId,
      userId,
      entityType: "AmlProfile",
      entityId: "bulk-backfill",
      action: "AML_PROFILE_BACKFILL_COMPLETED",
      newValue: { count: processed.length, clientIds: processed },
      source: "system",
      sensitivityLevel: "HIGH",
      request,
    })
    return ok({ created: processed.length, clientIds: processed })
  } catch (error) {
    return handleApiError(error)
  }
}
