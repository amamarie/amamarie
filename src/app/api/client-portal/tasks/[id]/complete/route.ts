import { fail, handleApiError, ok } from "@/lib/api-response"
import { findClientPortalRecord, getClientPortalApiUser } from "@/lib/client-portal"
import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"

type RouteContext = { params: Promise<{ id: string }> }

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await getClientPortalApiUser()
    const client = await findClientPortalRecord(user.email)
    if (!client) return fail("CLIENT_NOT_LINKED", "Aucun dossier client n’est lié à ce courriel.", 404)

    const { id } = await params
    const task = await prisma.task.findFirst({
      where: {
        id,
        organizationId: client.organizationId,
        clientId: client.id,
        status: { notIn: ["DONE", "ARCHIVED", "CANCELLED"] },
      },
    })
    if (!task) return fail("TASK_NOT_FOUND", "Action introuvable dans votre dossier.", 404)

    const body = await request.json().catch(() => ({}))
    const clientOutcome = cleanText(body.outcome)
    const outcome = clientOutcome || "Confirmé comme complété depuis le portail client."

    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "DONE",
        completedAt: new Date(),
        outcome,
      },
    })

    await createCrmActivity({
      organizationId: client.organizationId,
      userId: user.id,
      clientId: client.id,
      taskId: updated.id,
      type: "TASK_COMPLETED",
      title: "Action client complétée",
      description: `${updated.title} - ${outcome}`,
      entityType: "Task",
      entityId: updated.id,
      source: "WEBHOOK",
      metadata: { channel: "CLIENT_PORTAL" },
    })

    if (client.advisorId) {
      await prisma.notification.create({
        data: {
          organizationId: client.organizationId,
          userId: client.advisorId,
          type: "TASK_ASSIGNED",
          priority: "NORMAL",
          status: "UNREAD",
          title: "Action client complétée",
          message: `${client.firstName} ${client.lastName}: ${updated.title}`,
          actionLabel: "Ouvrir le dossier",
          actionUrl: `/clients/${client.id}`,
          href: `/clients/${client.id}`,
          entityType: "TASK",
          entityId: updated.id,
          clientId: client.id,
          taskId: updated.id,
        },
      })
    }

    return ok(updated)
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN_CLIENT_PORTAL") return fail("FORBIDDEN", "Accès client requis.", 403)
    return handleApiError(error)
  }
}
