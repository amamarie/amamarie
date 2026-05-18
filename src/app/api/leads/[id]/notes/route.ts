import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { createNote } from "@/lib/services/notes"
import { getTenantContext } from "@/lib/tenant"
import { createNoteSchema } from "@/lib/validations/note"

type RouteContext = { params: Promise<{ id: string }> }

async function getCurrentTenantUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({
    where: { id: tenant.userId, organizationId: tenant.organizationId },
    select: { id: true, organizationId: true, role: true },
  })
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentTenantUser()
    const lead = await prisma.lead.findFirst({ where: { id, organizationId: user.organizationId }, select: { id: true } })
    if (!lead) return fail("NOT_FOUND", "Prospect introuvable.", 404)

    const payload = createNoteSchema.omit({ leadId: true }).parse(await request.json())
    return ok(await createNote({ user, data: { ...payload, leadId: id } }), { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "NOTE_FORBIDDEN") return fail("FORBIDDEN", "Accès refusé à cette note.", 403)
    return handleApiError(error)
  }
}

