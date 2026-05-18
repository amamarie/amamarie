import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const client = await prisma.client.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    const snapshots = await prisma.kycSnapshot.findMany({
      where: { organizationId, clientId: id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { insuranceNeedsAnalyses: true } },
      },
      orderBy: { version: "desc" },
    })
    return ok(snapshots)
  } catch (error) {
    return handleApiError(error)
  }
}
