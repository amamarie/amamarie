import { NextResponse } from "next/server"

import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { getTenantContext, UnauthorizedError } from "@/lib/tenant"
import { createTaskSchema } from "@/lib/validations/task"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = (await request.json()) as Record<string, unknown>
    const data = createTaskSchema.omit({ leadId: true, clientId: true }).parse({
      ...body,
      dueDate: body.dueDate === "" ? undefined : body.dueDate,
      description: body.description === "" ? undefined : body.description,
      assignedToId: body.assignedToId === "" ? undefined : body.assignedToId,
    })

    const lead = await prisma.lead.findFirst({
      where: { id, organizationId },
      select: { id: true, firstName: true, lastName: true },
    })

    if (!lead) {
      return NextResponse.json(
        { error: "Prospect introuvable." },
        { status: 404 }
      )
    }

    const task = await prisma.task.create({
      data: {
        organizationId,
        leadId: lead.id,
        assignedToId: data.assignedToId || userId,
        title: data.title,
        description: data.description,
        dueDate: data.dueDate,
        priority: data.priority,
        status: data.status,
      },
      include: { assignedTo: true, lead: true, client: true },
    })

    await createCrmActivity({
      organizationId,
      userId,
      leadId: lead.id,
      type: "TASK_CREATED",
      title: "Tâche créée",
      description: `${task.title} a été ajoutée au prospect ${lead.firstName} ${lead.lastName}.`,
    })

    return NextResponse.json({ data: task }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    return NextResponse.json(
      { error: "Impossible de créer la tâche." },
      { status: 400 }
    )
  }
}
