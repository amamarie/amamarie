import type { AiAlertExplanationOutput } from "./schemas"

const forbiddenPatterns = [
  /\bdoit\s+acheter\b/i,
  /\bdevrait\s+acheter\b/i,
  /\brecommandez\b/i,
  /\brecommander\s+(une|un|ce|cette)\b/i,
  /\bmeilleur choix\b/i,
  /\best admissible\b/i,
  /\bobligatoire légalement\b/i,
  /\bpromet(?:tre|)\s+un rendement\b/i,
  /\brendement garanti\b/i,
  /\b\d[\d\s]{2,}\s?\$\s+de couverture\b/i,
]

const allowedActionTypes = new Set([
  "CREATE_TASK",
  "CREATE_NOTE",
  "REQUEST_DOCUMENT",
  "SCHEDULE_REVIEW",
  "UPDATE_CLIENT_FIELD",
  "UPDATE_PRODUCT_FIELD",
  "MARK_ALERT_REVIEWED",
])

export function validateAiAlertExplanationSafety(output: AiAlertExplanationOutput) {
  const combinedText = [
    output.summary,
    output.whyItTriggered,
    output.clientContext,
    output.advisorNoteDraft,
    output.clientMessageDraft,
    output.riskLevelExplanation,
  ]
    .filter(Boolean)
    .join("\n")

  const forbidden = forbiddenPatterns.find((pattern) => pattern.test(combinedText))
  if (forbidden) {
    return {
      ok: false,
      reason: "La réponse contient une formulation trop prescriptive.",
    }
  }

  if (!output.complianceDisclaimer.toLowerCase().includes("ne remplace pas")) {
    return {
      ok: false,
      reason: "Le rappel de prudence est manquant.",
    }
  }

  const invalidAction = output.suggestedActions.find((action) => !allowedActionTypes.has(action.type))
  if (invalidAction) {
    return {
      ok: false,
      reason: "Une action suggérée n'est pas autorisée.",
    }
  }

  return { ok: true, reason: null }
}
