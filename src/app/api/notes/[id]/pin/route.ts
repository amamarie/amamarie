import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { pinNote } from "@/lib/services/notes"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

async function getCurrentTenantUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({
    where: { id: tenant.userId, organizationId: tenant.organizationId },
    select: { id: true, organizationId: true, role: true },
  })
}

export async function PATCH(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentTenantUser()
    return ok(await pinNote({ user, id }))
  } catch (error) {
    if (error instanceof Error && error.message === "NOTE_FORBIDDEN") return fail("FORBIDDEN", "Accès refusé à cette note.", 403)
    if (error instanceof Error && error.message === "NOTE_NOT_FOUND") return fail("NOT_FOUND", "Note introuvable.", 404)
    return handleApiError(error)
  }
}

