import { handleApiError, ok } from "@/lib/api-response"
import { requireOwner } from "@/lib/auth"
import { checkN8nHealth } from "@/lib/automation/n8n"

export async function GET() {
  try {
    await requireOwner()
    const status = await checkN8nHealth()
    return ok(status)
  } catch (error) {
    return handleApiError(error)
  }
}
