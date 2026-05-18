import { handleApiError, ok } from "@/lib/api-response"
import { reviewPrivacyAccessRiskEvent } from "@/lib/privacy/advanced"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    return ok(await prisma.privacyAccessRiskEvent.findMany({
      where: { organizationId, ...(status ? { status } : {}) },
      include: { user: { select: { id: true, name: true, role: true } }, reviewedBy: { select: { id: true, name: true, role: true } } },
      orderBy: [{ riskScore: "desc" }, { createdAt: "desc" }],
      take: 100,
    }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json()
    const eventId = typeof body.eventId === "string" ? body.eventId : ""
    const status = typeof body.status === "string" ? body.status : "REVIEWED"
    return ok(await reviewPrivacyAccessRiskEvent({ organizationId, userId, eventId, status }))
  } catch (error) {
    return handleApiError(error)
  }
}
