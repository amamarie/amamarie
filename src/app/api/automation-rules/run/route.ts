import { handleApiError, ok } from "@/lib/api-response"
import { runAutomationsForEvent } from "@/lib/crm-events"
import { getTenantContext } from "@/lib/tenant"
import { z } from "zod"
import { automationTriggerSchema } from "@/lib/validations/automation"

const runAutomationSchema = z.object({
  event: automationTriggerSchema,
  entityType: z.enum(["lead", "client", "task", "document", "product", "note"]).optional(),
  entityId: z.string().optional(),
  leadId: z.string().optional(),
  clientId: z.string().optional(),
  title: z.string().min(1).default("Automatisation manuelle"),
  description: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = runAutomationSchema.parse(await request.json())

    await runAutomationsForEvent({
      organizationId,
      userId,
      event: payload.event,
      entityType: payload.entityType,
      entityId: payload.entityId,
      leadId: payload.leadId,
      clientId: payload.clientId,
      title: payload.title,
      description: payload.description,
    })

    return ok({ executed: true })
  } catch (error) {
    return handleApiError(error)
  }
}
