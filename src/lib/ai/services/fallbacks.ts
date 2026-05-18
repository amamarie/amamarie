import { AI_COMPLIANCE_DISCLAIMER } from "@/lib/ai/prompts/system"
import type { AiActionsOutput, AiCallSummaryOutput, AiMeetingPrepOutput, AiMessageOutput, AiSummaryOutput } from "@/lib/ai/schemas/ai-output"

type LooseRecord = Record<string, unknown>

function asRecord(value: unknown): LooseRecord {
  return value && typeof value === "object" ? (value as LooseRecord) : {}
}

function asArray(value: unknown): LooseRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback
}

function hasActionableDocument(context: LooseRecord) {
  return asArray(context.documents).some((document) => ["REQUIRED", "REQUESTED", "EXPIRED"].includes(text(document.status)))
}

export function buildClientSummaryFallback(input: unknown): AiSummaryOutput {
  const context = asRecord(input)
  const documents = asArray(context.documents)
  const products = asArray(context.products)
  const openTasks = asArray(context.openTasks)
  const missingData = [
    !context.riskProfile || context.riskProfile === "UNKNOWN" ? "Profil de risque à valider" : null,
    !context.primaryGoal ? "Objectif principal à préciser" : null,
    !context.kycCompleted ? "Profil client à compléter ou valider" : null,
    hasActionableDocument(context) ? "Documents requis ou expirés à traiter" : null,
  ].filter(Boolean) as string[]

  return {
    summary: `${text(context.name, "Ce dossier")} est un client au statut ${text(context.status, "non défini")}. Le dossier contient ${products.length} produit(s), ${openTasks.length} tâche(s) ouverte(s) et ${documents.length} document(s) récent(s).`,
    keyPoints: [
      `Statut client: ${text(context.status, "non défini")}`,
      `Conformité: ${text(context.complianceStatus, "non définie")}`,
      `Dernier contact: ${text(context.lastContactAt, "non renseigné")}`,
    ],
    risks: asArray(context.alerts).map((alert) => text(alert.title)).filter(Boolean).slice(0, 4),
    missingData,
    suggestedNextSteps: [
      missingData.length > 0 ? "Créer une tâche de validation des informations manquantes" : "Planifier le prochain suivi administratif",
      openTasks.length ? "Réviser les tâches ouvertes du dossier" : "Documenter la prochaine action dans une note interne",
    ],
    disclaimer: AI_COMPLIANCE_DISCLAIMER,
  }
}

export function buildCallSummaryFallback(note: string): AiCallSummaryOutput {
  return {
    summary: note.trim().slice(0, 800) || "Note d’appel à structurer.",
    needs: ["Clarifier le besoin exprimé par le client ou prospect"],
    questions: ["Quels éléments doivent être validés avant le prochain suivi?"],
    nextSteps: ["Créer une tâche de suivi", "Ajouter une note interne au dossier"],
    followUpSuggestion: "Planifier un suivi administratif avec validation humaine.",
    disclaimer: AI_COMPLIANCE_DISCLAIMER,
  }
}

export function buildActionsFallback(input: unknown): AiActionsOutput {
  const context = asRecord(input)
  const actions = [
    {
      label: "Créer une tâche de suivi",
      priority: context.priority === "URGENT" ? "URGENT" : "HIGH",
      type: "CREATE_TASK",
      rationale: "Un suivi clair réduit le risque d’oubli.",
    },
    {
      label: "Ajouter une note de synthèse",
      priority: "NORMAL",
      type: "ADD_NOTE",
      rationale: "Documenter le contexte facilite la continuité du dossier.",
    },
  ] as AiActionsOutput["actions"]

  if (hasActionableDocument(context)) {
    actions.unshift({
      label: "Valider les documents requis",
      priority: "HIGH",
      type: "REQUEST_DOCUMENT",
      rationale: "Des documents sont manquants ou à vérifier.",
    })
  }

  return {
    actions,
    missingData: [
      !context.riskProfile && context.status ? "Profil de risque non renseigné" : null,
      !context.nextAction && context.source ? "Prochaine action non définie" : null,
    ].filter(Boolean) as string[],
    rationale: "Actions administratives proposées à partir des données visibles du dossier.",
    disclaimer: AI_COMPLIANCE_DISCLAIMER,
  }
}

export function buildMessageFallback({ clientName, context }: { clientName?: string; context: string }): AiMessageOutput {
  return {
    draft: `Bonjour ${clientName || ""},\n\nJe fais un suivi concernant ${context || "votre dossier"}. Seriez-vous disponible pour un court échange afin de valider les prochaines étapes administratives?\n\nMerci,`,
    validationRequired: true,
    warnings: ["Brouillon uniquement. Le conseiller doit valider le contenu avant envoi."],
    disclaimer: AI_COMPLIANCE_DISCLAIMER,
  }
}

export function buildMeetingPrepFallback(input: unknown): AiMeetingPrepOutput {
  const context = asRecord(input)
  return {
    summary: `Préparer la rencontre avec ${text(context.name, "ce contact")} en révisant les tâches ouvertes, documents requis et informations manquantes.`,
    topics: ["Contexte du dossier", "Informations à mettre à jour", "Documents ou tâches en attente"],
    questions: ["Y a-t-il des changements récents à documenter?", "Quels documents doivent être validés?"],
    documentsToCheck: asArray(context.documents).filter((document) => document.status !== "VALIDATED").map((document) => text(document.name)).filter(Boolean).slice(0, 6),
    suggestedActions: buildActionsFallback(context).actions.slice(0, 3),
    disclaimer: AI_COMPLIANCE_DISCLAIMER,
  }
}
