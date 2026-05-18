"use client"

type ApiEnvelope<T> = {
  ok?: boolean
  data?: T
  error?: {
    message?: string
    code?: string
  }
}

function normalizePath(path: string) {
  if (path.startsWith("/api/")) return path
  if (path.startsWith("/")) return `/api${path}`
  return `/api/${path}`
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(normalizePath(path), {
    cache: "no-store",
    ...init,
    headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers },
  })
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "La requête a échoué.")
  }
  return payload.data as T
}

export async function uploadDocument<T>(formData: FormData): Promise<T> {
  const category = formData.get("document_category")
  const folderId = formData.get("folder_id")
  const clientId = formData.get("client_id")

  if (typeof category === "string" && !formData.has("type")) formData.set("type", category)
  if (typeof folderId === "string" && !formData.has("folderId")) formData.set("folderId", folderId)
  if (typeof clientId === "string" && !formData.has("clientId")) formData.set("clientId", clientId)

  return apiRequest<T>("/documents/upload", {
    method: "POST",
    body: formData,
  })
}
