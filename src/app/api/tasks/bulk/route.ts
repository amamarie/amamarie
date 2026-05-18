import { z } from "zod"

import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

const bulkTaskSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
})

export async function PATCH(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const { ids } = bulkTaskSchema.parse(await request.json())
    const uniqueIds = Array.from(new Set(ids))
    const tasks = await prisma.task.findMany({
      where: {
        id: { in: uniqueIds },
        organizationId,
        status: { not: "ARCHIVED" },
      },
      select: {
        id: true,
        title: true,
        leadId: true,
        clientId: true,
      },
    })

    if (tasks.length === 0) {
      return ok({ archived: 0, ids: [] })
    }

    await prisma.$transaction([
      prisma.task.updateMany({
        where: { id: { in: tasks.map((task) => task.id) }, organizationId },
        data: { status: "ARCHIVED" },
      }),
      prisma.activity.createMany({
        data: tasks.map((task) => ({
          organizationId,
          userId,
          leadId: task.leadId,
          clientId: task.clientId,
          taskId: task.id,
          type: "TASK_UPDATED",
          title: "Tâche archivée",
          description: task.title,
          entityType: "Task",
          entityId: task.id,
        })),
      }),
    ])

    return ok({ archived: tasks.length, ids: tasks.map((task) => task.id) })
  } catch (error) {
    return handleApiError(error)
  }
}
