import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const tenant = await getTenantContext()
    const { id } = await params
    const client = await prisma.client.findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
        status: { not: "ARCHIVED" },
      },
      select: { id: true, organizationId: true, firstName: true, lastName: true },
    })
    if (!client) return fail("CLIENT_NOT_FOUND", "Client introuvable.", 404)

    const body = await request.json()
    const subject = cleanText(body.subject || body.title) || "Message de votre conseiller"
    const message = cleanText(body.message || body.description || body.content)
    if (message.length < 2) return fail("VALIDATION_ERROR", "Le message doit contenir au moins 2 caractères.", 422)
    if (message.length > 5000) return fail("VALIDATION_ERROR", "Le message ne peut pas dépasser 5 000 caractères.", 422)

    const note = await prisma.note.create({
      data: {
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        clientId: client.id,
        type: "GENERAL",
        visibility: "TEAM",
        title: `Message portail client - ${subject.slice(0, 120)}`,
        content: message,
      },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    })

    await prisma.activity.create({
      data: {
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        clientId: client.id,
        noteId: note.id,
        type: "NOTE_ADDED",
        title: "Message envoyé au portail client",
        description: subject,
        source: "USER",
        entityType: "Note",
        entityId: note.id,
      },
    })

    return ok(note, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
