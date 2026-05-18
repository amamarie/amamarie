type PandaDocRecipient = {
  email: string
  firstName: string
  lastName: string
  role?: string
}

type CreatePandaDocFromPdfInput = {
  name: string
  pdfBuffer: Buffer
  fileName: string
  recipient: PandaDocRecipient
  metadata?: Record<string, string>
}

type PandaDocDocumentResponse = {
  id: string
  name?: string
  status?: string
}

function getPandaDocConfig() {
  const apiKey = process.env.PANDADOC_API_KEY?.trim()
  if (!apiKey) throw new Error("PANDADOC_NOT_CONFIGURED")
  return {
    apiKey,
    baseUrl: (process.env.PANDADOC_API_BASE_URL?.trim() || "https://api.pandadoc.com").replace(/\/$/, ""),
    sendSilent: process.env.PANDADOC_SEND_SILENT === "true",
  }
}

async function pandaDocFetch<T>(path: string, init: RequestInit = {}) {
  const config = getPandaDocConfig()
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `API-Key ${config.apiKey}`,
      ...(init.headers ?? {}),
    },
  })
  const text = await response.text()
  const json = (text ? JSON.parse(text) : {}) as T & { detail?: string; error?: string; message?: string }
  if (!response.ok) {
    const message = json.detail ?? json.error ?? json.message ?? `PandaDoc a retourné ${response.status}.`
    throw new Error(`PANDADOC_API_ERROR:${message}`)
  }
  return json as T
}

async function pandaDocBinaryFetch(path: string) {
  const config = getPandaDocConfig()
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "GET",
    headers: {
      Authorization: `API-Key ${config.apiKey}`,
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`PANDADOC_API_ERROR:${text || `PandaDoc a retourné ${response.status}.`}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

export async function createPandaDocDocumentFromPdf(input: CreatePandaDocFromPdfInput) {
  const role = input.recipient.role ?? "client"
  const data = {
    name: input.name,
    recipients: [
      {
        email: input.recipient.email,
        first_name: input.recipient.firstName,
        last_name: input.recipient.lastName,
        role,
      },
    ],
    parse_form_fields: false,
    metadata: input.metadata,
    fields: {
      client_signature: { value: "", role },
      client_signed_at: { value: "", role },
    },
  }
  const formData = new FormData()
  formData.append("file", new Blob([new Uint8Array(input.pdfBuffer)], { type: "application/pdf" }), input.fileName)
  formData.append("data", JSON.stringify(data))
  return pandaDocFetch<PandaDocDocumentResponse>("/public/v1/documents", {
    method: "POST",
    body: formData,
  })
}

export async function getPandaDocDocument(id: string) {
  return pandaDocFetch<PandaDocDocumentResponse>(`/public/v1/documents/${encodeURIComponent(id)}`, {
    method: "GET",
  })
}

export async function waitForPandaDocDraft(id: string) {
  let latest = await getPandaDocDocument(id)
  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (latest.status === "document.draft") return latest
    if (latest.status?.includes("failed")) throw new Error(`PANDADOC_DOCUMENT_FAILED:${latest.status}`)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    latest = await getPandaDocDocument(id)
  }
  return latest
}

export async function sendPandaDocDocument(id: string, input: { subject: string; message: string }) {
  const config = getPandaDocConfig()
  return pandaDocFetch<PandaDocDocumentResponse>(`/public/v1/documents/${encodeURIComponent(id)}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: input.subject,
      message: input.message,
      silent: config.sendSilent,
    }),
  })
}

export async function downloadPandaDocDocument(id: string) {
  return pandaDocBinaryFetch(`/public/v1/documents/${encodeURIComponent(id)}/download`)
}
