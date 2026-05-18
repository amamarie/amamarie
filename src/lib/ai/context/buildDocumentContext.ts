export function buildDocumentContext(input: unknown) {
  const document = input && typeof input === "object" ? (input as Record<string, unknown>) : {}
  return {
    id: document.id,
    name: document.name,
    type: document.type,
    status: document.status,
    visibility: document.visibility,
    expiresAt: document.expiresAt,
    clientId: document.clientId,
    leadId: document.leadId,
    description: typeof document.description === "string" ? document.description.slice(0, 600) : "",
  }
}
