import { handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import { upsertLeadFormAutomationWorkflows } from "@/lib/automation/n8n"

export async function POST() {
  try {
    await requireOwner()
    const workflows = await upsertLeadFormAutomationWorkflows()
    return ok(workflows)
  } catch (error) {
    return handleApiError(error)
  }
}
