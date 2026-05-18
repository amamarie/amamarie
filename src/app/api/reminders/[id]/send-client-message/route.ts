import { fail, handleApiError, ok } from "@/lib/api-response"
import { sendClientMessageFromSmartReminder } from "@/lib/smart-reminders/service"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const body = await request.json().catch(() => ({}))
    const result = await sendClientMessageFromSmartReminder({
      organizationId,
      reminderId: id,
      userId,
      subject: clean(body.subject),
      message: clean(body.message),
      kind: clean(body.kind) ?? "SERVICE",
    })
    return ok(result, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CLIENT_MESSAGE_CONSENT_BLOCKED:")) {
      return fail("CONSENT_BLOCKED", error.message.replace("CLIENT_MESSAGE_CONSENT_BLOCKED:", ""), 409)
    }
    return handleApiError(error)
  }
}
