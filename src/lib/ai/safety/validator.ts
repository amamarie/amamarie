const forbiddenPatterns = [
  /\b(acheter|vendre|souscrire)\s+(ce|cette|un|une)\s+(produit|assurance|fonds|placement)\b/i,
  /\brecommande(r|z)?\s+(ce|cette|un|une)\b/i,
  /\bmeilleur\s+(produit|choix|placement)\b/i,
  /\bgaranti\s+(à|a)\s+\d/i,
  /\brendement\s+garanti\b/i,
  /\b\d[\d\s.,]*\s?\$?\s+de\s+couverture\b/i,
  /\bcouverture\s+de\s+\d[\d\s.,]*\s?\$?\b/i,
  /\btu\s+devrais\b/i,
  /\bvous\s+devriez\s+(acheter|souscrire|investir)\b/i,
]

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(collectStrings)
  if (value && typeof value === "object") return Object.values(value).flatMap(collectStrings)
  return []
}

export function validateAIOutput(output: unknown) {
  const text = collectStrings(output).join("\n")
  const forbidden = forbiddenPatterns.find((pattern) => pattern.test(text))
  if (forbidden) {
    return { ok: false, reason: "La sortie IA contient une formulation de conseil financier non autorisée." }
  }

  if (!/validation humaine|ne remplace pas|aide interne/i.test(text)) {
    return { ok: false, reason: "La sortie IA doit rappeler la validation humaine." }
  }

  return { ok: true, reason: null }
}
