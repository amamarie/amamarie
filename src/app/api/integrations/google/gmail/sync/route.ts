import { z } from "zod"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { syncIncomingGmailMessages } from "@/lib/services/gmail-inbound-sync"
import { getTenantContext } from "@/lib/tenant"

const syncSchema = z.object({
  maxResults: z.coerce.number().int().min(1).max(50).default(15),
  query: z.string().max(500).optional(),
})

function messageForError(error: Error) {
  if (error.message === "GMAIL_NOT_CONNECTED") return "Connectez Gmail dans Paramètres avant de synchroniser les courriels entrants."
  if (error.message === "GMAIL_READ_SCOPE_MISSING") return "Reconnectez Google Workspace pour autoriser la lecture Gmail entrante."
  if (error.message.startsWith("GMAIL_SYNC_FAILED")) return "Gmail n’a pas pu synchroniser les courriels entrants."
  return null
}

export async function POST(request: Request) {
  try {
    const { organizationId, userId } = await getTenantContext()
    const payload = syncSchema.parse(await request.json().catch(() => ({})))
    const result = await syncIncomingGmailMessages({ organizationId, userId, ...payload })
    return ok(result)
  } catch (error) {
    if (error instanceof Error) {
      const message = messageForError(error)
      if (message) return fail(error.message, message, error.message === "GMAIL_READ_SCOPE_MISSING" ? 409 : 502)
    }
    return handleApiError(error)
  }
}
