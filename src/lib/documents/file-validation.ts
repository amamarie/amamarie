const MAX_FILE_SIZE = 10 * 1024 * 1024

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"])
const blockedExtensions = new Set([".exe", ".sh", ".bat", ".js", ".zip"])

export function sanitizeFileName(name: string) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase()
}

export function getFileExtension(name: string) {
  const match = /\.[a-zA-Z0-9]+$/.exec(name)
  return match?.[0]?.toLowerCase() ?? ""
}

export async function getFileChecksum(file: File) {
  const buffer = await file.arrayBuffer()
  const hash = await crypto.subtle.digest("SHA-256", buffer)
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function validateDocumentFile(file: File) {
  if (!file || file.size <= 0) {
    throw new Error("Le fichier est vide ou invalide.")
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Le fichier dépasse la limite de 10 Mo.")
  }

  const extension = getFileExtension(file.name)
  if (!extension) {
    throw new Error("Le fichier doit avoir une extension valide.")
  }
  if (blockedExtensions.has(extension)) {
    throw new Error("Ce type de fichier est bloqué pour des raisons de sécurité.")
  }
  if (!allowedExtensions.has(extension)) {
    throw new Error("Extension non autorisée. Formats permis: PDF, JPG, PNG, WEBP, DOC, DOCX.")
  }
  if (!file.type || !allowedMimeTypes.has(file.type)) {
    throw new Error("Type de fichier non autorisé. Formats permis: PDF, images et documents Word.")
  }
}

export function canPreviewMimeType(mimeType?: string | null) {
  return Boolean(mimeType && ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(mimeType))
}

