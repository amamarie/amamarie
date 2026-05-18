import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    const alerts = await prisma.amlAlert.findMany({
      where: { organizationId, status: { notIn: ["RESOLVED", "CLOSED", "ARCHIVED"] } },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ blocking: "desc" }, { createdAt: "desc" }],
      take: 100,
    })
    return ok({ alerts })
  } catch (error) {
    return handleApiError(error)
  }
}
