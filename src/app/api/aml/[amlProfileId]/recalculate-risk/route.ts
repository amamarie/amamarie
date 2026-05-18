import { fail, handleApiError, ok } from "@/lib/api-response"
import { recalculateAmlRisk } from "@/lib/aml/service"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ amlProfileId: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { amlProfileId } = await params
    const { organizationId, userId } = await getTenantContext()
    const profile = await prisma.amlProfile.findFirst({ where: { id: amlProfileId, organizationId }, select: { clientId: true } })
    if (!profile) return fail("NOT_FOUND", "Profil AML introuvable.", 404)
    const recalculated = await recalculateAmlRisk({ organizationId, clientId: profile.clientId, userId, request })
    return ok({ profile: recalculated })
  } catch (error) {
    return handleApiError(error)
  }
}
