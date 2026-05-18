import { handleApiError, ok } from "@/lib/api-response"
import { upsertInboundCallReceptionWorkflow } from "@/lib/automation/n8n"
import { requireOwner } from "@/lib/auth"

export async function POST() {
  try {
    await requireOwner()
    const workflow = await upsertInboundCallReceptionWorkflow()
    return ok({ inboundCallReceptionWorkflow: workflow })
  } catch (error) {
    return handleApiError(error)
  }
}
