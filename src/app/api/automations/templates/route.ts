import { handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import { automationTemplates } from "@/lib/automation/defaults"

export async function GET() {
  try {
    await requireOwner()
    return ok(automationTemplates)
  } catch (error) {
    return handleApiError(error)
  }
}
