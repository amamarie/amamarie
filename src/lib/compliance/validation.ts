export function normalizeSensitiveAuditValue(value: unknown) {
  if (typeof value === "string" && value.length > 80) return "[valeur masquée]"
  return value
}
