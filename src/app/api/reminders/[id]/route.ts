import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const existing = await prisma.smartReminder.findFirst({ where: { id, organizationId } })
    if (!existing) throw new Error("REMINDER_NOT_FOUND")
    const reminder = await prisma.smartReminder.update({
      where: { id },
      data: {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.reason === "string" ? { reason: body.reason } : {}),
        ...(typeof body.description === "string" ? { description: body.description } : {}),
        ...(typeof body.category === "string" ? { category: body.category } : {}),
        ...(typeof body.priority === "string" ? { priority: body.priority } : {}),
        ...(typeof body.status === "string" ? { status: body.status } : {}),
        ...(typeof body.recommendedAction === "string" ? { recommendedAction: body.recommendedAction } : {}),
        ...(typeof body.dueDate === "string" ? { dueDate: new Date(body.dueDate) } : {}),
      },
    })
    return ok({ reminder })
  } catch (error) {
    return handleApiError(error)
  }
}
