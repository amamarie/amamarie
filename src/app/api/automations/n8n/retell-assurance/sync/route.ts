import { handleApiError, ok } from "@/lib/api-response"
import { upsertRetellAssurancePhoneAgentWorkflow } from "@/lib/automation/n8n"
import { requireOwner } from "@/lib/auth"

export async function POST() {
  try {
    await requireOwner()
    const workflow = await upsertRetellAssurancePhoneAgentWorkflow()
    return ok({ retellAssurancePhoneAgentWorkflow: workflow })
  } catch (error) {
    return handleApiError(error)
  }
}
