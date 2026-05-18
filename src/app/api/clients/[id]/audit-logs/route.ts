import { fail, handleApiError, ok } from "@/lib/api-response"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { canViewAuditLog } from "@/lib/compliance/permissions"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    if (!canViewAuditLog(user)) return fail("FORBIDDEN", "Accès refusé.", 403)
    const { organizationId } = await getTenantContext()
    const client = await prisma.client.findFirst({ where: { id, organizationId }, select: { id: true, advisorId: true } })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    if (user.role === "ADVISOR" && client.advisorId !== user.id) return fail("FORBIDDEN", "Accès refusé.", 403)
    return ok(await prisma.auditLog.findMany({
      where: { organizationId, clientId: id },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }))
  } catch (error) {
    return handleApiError(error)
  }
}
