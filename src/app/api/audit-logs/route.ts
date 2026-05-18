import { fail, handleApiError, ok } from "@/lib/api-response"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { canViewAuditLog } from "@/lib/compliance/permissions"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

export async function GET() {
  try {
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    if (!canViewAuditLog(user)) return fail("FORBIDDEN", "Accès refusé.", 403)
    const { organizationId } = await getTenantContext()
    return ok(await prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(user.role === "ADVISOR" ? { client: { advisorId: user.id } } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        client: { select: { id: true, firstName: true, lastName: true, advisorId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }))
  } catch (error) {
    return handleApiError(error)
  }
}
