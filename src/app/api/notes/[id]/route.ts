import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { deleteNote, getNoteById, updateNote } from "@/lib/services/notes"
import { getTenantContext } from "@/lib/tenant"
import { updateNoteSchema } from "@/lib/validations/note"

type RouteContext = {
  params: Promise<{ id: string }>
}

async function getCurrentTenantUser() {
  const tenant = await getTenantContext()
  return prisma.user.findFirstOrThrow({
    where: { id: tenant.userId, organizationId: tenant.organizationId },
    select: { id: true, organizationId: true, role: true },
  })
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentTenantUser()
    return ok(await getNoteById({ user, id }))
  } catch (error) {
    return handleNoteError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentTenantUser()
    const payload = updateNoteSchema.parse(await request.json())
    return ok(await updateNote({ user, id, data: payload }))
  } catch (error) {
    return handleNoteError(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentTenantUser()
    return ok(await deleteNote({ user, id }))
  } catch (error) {
    return handleNoteError(error)
  }
}

function handleNoteError(error: unknown) {
  if (error instanceof Error && error.message === "NOTE_FORBIDDEN") {
    return fail("FORBIDDEN", "Accès refusé à cette note.", 403)
  }
  if (error instanceof Error && error.message === "NOTE_NOT_FOUND") {
    return fail("NOT_FOUND", "Note introuvable.", 404)
  }
  return handleApiError(error)
}

