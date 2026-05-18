import { handleApiError, ok } from "@/lib/api-response"
import { convertCrossSellToTask } from "@/lib/cross-sell/actions"
import { getTenantContext } from "@/lib/tenant"
import { convertCrossSellToTaskSchema } from "@/lib/validations/cross-sell"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = convertCrossSellToTaskSchema.parse(await request.json().catch(() => ({})))
    return ok(
      await convertCrossSellToTask({
        id,
        organizationId,
        userId,
        assignedToId: payload.assignedToId,
        dueDate: payload.dueDate,
        title: payload.title,
      }),
      { status: 201 }
    )
  } catch (error) {
    return handleApiError(error)
  }
}
