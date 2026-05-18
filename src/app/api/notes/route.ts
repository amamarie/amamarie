import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { createNote, getNotes } from "@/lib/services/notes"
import { getTenantContext } from "@/lib/tenant"
import { createNoteSchema, noteQuerySchema } from "@/lib/validations/note"

async function getCurrentTenantUser() {
  const tenant = await getTenantContext()
  const user = await prisma.user.findFirstOrThrow({
    where: { id: tenant.userId, organizationId: tenant.organizationId },
    select: { id: true, organizationId: true, role: true },
  })
  return user
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentTenantUser()
    const query = noteQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams))
    return ok(await getNotes({ user, query }))
  } catch (error) {
    return handleNoteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentTenantUser()
    const payload = createNoteSchema.parse(await request.json())
    return ok(await createNote({ user, data: payload }), { status: 201 })
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

