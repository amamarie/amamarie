import { NextResponse } from "next/server"
import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"
import { createTaskSchema } from "@/lib/validations/task"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = (await request.json()) as Record<string, unknown>
    const payload = createTaskSchema.omit({ clientId: true, leadId: true }).parse({
      ...body,
      dueDate: body.dueDate === "" ? undefined : body.dueDate,
    })
    const client = await prisma.client.findFirst({
      where: { id, organizationId },
      select: { id: true, firstName: true, lastName: true },
    })
    if (!client) return NextResponse.json({ error: "Client introuvable." }, { status: 404 })

    const task = await prisma.task.create({
      data: {
        ...payload,
        organizationId,
        clientId: client.id,
        assignedToId: payload.assignedToId || userId,
      },
      include: { assignedTo: true, client: true },
    })
    await createCrmActivity({
      organizationId,
      userId,
      clientId: client.id,
      type: "TASK_CREATED",
      title: "Tâche créée",
      description: `${task.title} a été ajoutée au client ${client.firstName} ${client.lastName}.`,
    })
    return NextResponse.json({ data: task }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 })
    return NextResponse.json({ error: "Impossible de créer la tâche." }, { status: 400 })
  }
}
