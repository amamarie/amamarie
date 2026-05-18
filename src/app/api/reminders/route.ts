import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { listSmartReminders } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const url = new URL(request.url)
    const clientId = url.searchParams.get("clientId") ?? undefined
    const status = url.searchParams.get("status") ?? undefined
    return ok({ reminders: await listSmartReminders({ organizationId, clientId, status }) })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const clientId = String(body.clientId ?? "")
    if (!clientId) throw new Error("CLIENT_NOT_FOUND")
    const client = await prisma.client.findFirst({ where: { id: clientId, organizationId }, select: { id: true, advisorId: true } })
    if (!client) throw new Error("CLIENT_NOT_FOUND")
    const reminder = await prisma.smartReminder.create({
      data: {
        organizationId,
        clientId,
        advisorId: typeof body.advisorId === "string" ? body.advisorId : client.advisorId,
        title: String(body.title ?? "Rappel manuel"),
        reason: String(body.reason ?? "Rappel créé manuellement."),
        description: typeof body.description === "string" ? body.description : null,
        category: String(body.category ?? "RELATION"),
        priority: String(body.priority ?? "NORMAL"),
        dueDate: typeof body.dueDate === "string" ? new Date(body.dueDate) : null,
        recommendedAction: typeof body.recommendedAction === "string" ? body.recommendedAction : "À traiter par le conseiller.",
        sourceEntityType: typeof body.sourceEntityType === "string" ? body.sourceEntityType : "CLIENT",
        sourceEntityId: typeof body.sourceEntityId === "string" ? body.sourceEntityId : clientId,
        actionUrl: typeof body.actionUrl === "string" ? body.actionUrl : `/clients/${clientId}`,
        dedupeKey: `manual:${clientId}:${Date.now()}`,
        metadata: { createdById: userId, manual: true },
      },
    })
    return ok({ reminder }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
