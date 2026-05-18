import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const recommendation = await prisma.productRecommendation.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!recommendation) return fail("NOT_FOUND", "Recommandation introuvable.", 404)
    const versions = await prisma.recommendationVersion.findMany({
      where: { organizationId, recommendationId: id },
      include: { changedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { versionNumber: "desc" },
    })
    return ok(versions)
  } catch (error) {
    return handleApiError(error)
  }
}
