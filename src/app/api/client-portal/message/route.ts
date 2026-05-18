import { fail, handleApiError, ok } from "@/lib/api-response"
import { getClientPortalApiUser, findClientPortalRecord } from "@/lib/client-portal"
import { prisma } from "@/lib/prisma"

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function POST(request: Request) {
  try {
    const user = await getClientPortalApiUser()
    const client = await findClientPortalRecord(user.email)
    if (!client) return fail("CLIENT_NOT_LINKED", "Aucun dossier client n’est lié à ce courriel.", 404)

    const body = await request.json()
    const subject = cleanText(body.subject) || "Question du client"
    const message = cleanText(body.message)
    if (message.length < 2) return fail("VALIDATION_ERROR", "Le message doit contenir au moins 2 caractères.", 422)
    if (message.length > 5000) return fail("VALIDATION_ERROR", "Le message ne peut pas dépasser 5 000 caractères.", 422)

    const note = await prisma.note.create({
      data: {
        organizationId: client.organizationId,
        userId: user.id,
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
        organizationId: client.organizationId,
        userId: user.id,
        clientId: client.id,
        noteId: note.id,
        type: "NOTE_ADDED",
        title: "Message reçu du portail client",
        description: subject,
        source: "CLIENT_PORTAL",
        entityType: "Note",
        entityId: note.id,
      },
    })

    if (client.advisorId) {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 1)

      const task = await prisma.task.create({
        data: {
          organizationId: client.organizationId,
          assignedToId: client.advisorId,
          createdById: user.id,
          clientId: client.id,
          type: "FOLLOW_UP",
          priority: "HIGH",
          status: "TODO",
          dueDate,
          title: `Répondre au client - ${client.firstName} ${client.lastName}`,
          description: `${subject}\n\n${message}`,
          isAutomated: true,
        },
      })

      await prisma.notification.create({
        data: {
          organizationId: client.organizationId,
          userId: client.advisorId,
          type: "INFO",
          priority: "HIGH",
          status: "UNREAD",
          title: "Nouveau message client",
          message: `${client.firstName} ${client.lastName}: ${subject}`,
          actionLabel: "Ouvrir le dossier",
          actionUrl: `/clients/${client.id}`,
          href: `/clients/${client.id}`,
          entityType: "CLIENT",
          entityId: client.id,
          clientId: client.id,
          taskId: task.id,
        },
      })
    }

    return ok(note, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_CLIENT_PORTAL") return fail("FORBIDDEN", "Accès client requis.", 403)
    return handleApiError(error)
  }
}
