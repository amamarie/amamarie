export function normalizePhoneNumber(phone?: string | null) {
  if (!phone) return ""
  const trimmed = phone.trim()
  if (!trimmed) return ""
  const digits = trimmed.replace(/[^\d+]/g, "")
  if (digits.startsWith("+")) return `+${digits.slice(1).replace(/\D/g, "")}`
  const onlyDigits = digits.replace(/\D/g, "")
  if (onlyDigits.length === 10) return `+1${onlyDigits}`
  if (onlyDigits.length === 11 && onlyDigits.startsWith("1")) return `+${onlyDigits}`
  return onlyDigits ? `+${onlyDigits}` : ""
}

export function comparePhoneNumbers(a?: string | null, b?: string | null) {
  return normalizePhoneNumber(a) === normalizePhoneNumber(b)
}

export function formatPhoneDisplay(phone?: string | null) {
  const normalized = normalizePhoneNumber(phone)
  if (!normalized.startsWith("+1") || normalized.length !== 12) return normalized || "Non renseigne"
  return `+1 ${normalized.slice(2, 5)} ${normalized.slice(5, 8)}-${normalized.slice(8)}`
}
