import { z } from "zod"

import { runAI } from "@/lib/ai/core/run-ai"

const insuranceNeedsAiSchema = z.object({
  summary: z.string(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  riskScore: z.number().min(0).max(100).default(50),
  advisorAttentionPoints: z.array(z.string()).default([]),
  dataInconsistencies: z.array(z.object({
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
    title: z.string(),
    detail: z.string(),
  })).default([]),
  suggestedQuestions: z.array(z.string()).default([]),
  documentsToRequest: z.array(z.object({
    name: z.string(),
    reason: z.string(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  })).default([]),
  nextBestActions: z.array(z.object({
    label: z.string(),
    reason: z.string(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  })).default([]),
  clientExplanation: z.string(),
  complianceNotes: z.array(z.string()).default([]),
})

export type InsuranceNeedsAiSummary = z.infer<typeof insuranceNeedsAiSchema>

export function buildInsuranceNeedsFallback(context: {
  analysisType: string
  clientName: string
  missingData: string[]
  recommendedAmount: number
  reasoning: string
}): InsuranceNeedsAiSummary {
  return {
    summary: `Analyse ${context.analysisType} préparée pour ${context.clientName}. Montant recommandé à valider par le conseiller: ${context.recommendedAmount.toLocaleString("fr-CA")} $.`,
    riskLevel: context.missingData.length >= 4 ? "HIGH" : context.missingData.length ? "MEDIUM" : "LOW",
    riskScore: Math.min(90, 35 + context.missingData.length * 12),
    advisorAttentionPoints: context.missingData.length
      ? context.missingData.map((item) => `Valider ou documenter: ${item}.`)
      : ["Revoir les hypothèses avec le client avant toute recommandation finale."],
    dataInconsistencies: context.missingData.map((item) => ({
      severity: "MEDIUM" as const,
      title: "Donnée à confirmer",
      detail: `${item} doit être validé avant la remise d’un rapport final. Validation humaine obligatoire.`,
    })),
    suggestedQuestions: [
      "Les renseignements utilisés reflètent-ils toujours votre situation actuelle?",
      "Avez-vous une protection existante, collective ou personnelle, qui n’est pas encore au dossier?",
      "Y a-t-il eu un changement familial, professionnel ou financier récent à documenter?",
    ],
    documentsToRequest: context.missingData.map((item) => ({
      name: item,
      reason: "Document ou confirmation requis pour appuyer l’analyse. Validation humaine obligatoire.",
      priority: "HIGH" as const,
    })),
    nextBestActions: [
      {
        label: context.missingData.length ? "Compléter les données bloquantes" : "Réviser l’analyse avec le client",
        reason: "Le conseiller doit valider les renseignements avant toute recommandation finale. Aide interne seulement.",
        priority: context.missingData.length ? "HIGH" as const : "MEDIUM" as const,
      },
    ],
    clientExplanation: context.reasoning,
    complianceNotes: [
      "Validation humaine obligatoire par un conseiller autorisé.",
      "La recommandation finale doit être liée aux données du profil client, aux documents et aux notes du conseiller.",
    ],
  }
}

export async function summarizeInsuranceNeedsWithAI({
  organizationId,
  userId,
  context,
}: {
  organizationId: string
  userId: string
  context: {
    analysisType: string
    clientName: string
    results: unknown
    recommendation: unknown
    missingData: string[]
    inputs: unknown
  }
}) {
  return runAI({
    organizationId,
    userId,
    feature: "insurance-needs-analysis",
    prompt:
      [
        "Prépare une analyse intelligente interne pour le conseiller en assurance.",
        "Ne donne pas de conseil final automatique, ne recommande pas un produit précis et ne présente aucun montant comme décision finale.",
        "À partir des données CRM et profil client, résultats, recommandation interne et données manquantes, retourne un JSON complet avec:",
        "- un résumé prudent;",
        "- un niveau de risque opérationnel LOW/MEDIUM/HIGH/CRITICAL et un score 0-100;",
        "- les points à valider;",
        "- les incohérences ou données faibles;",
        "- les questions utiles à poser au client;",
        "- les documents à demander;",
        "- les prochaines actions internes du conseiller;",
        "- une explication client simple et prudente;",
        "- des notes conformité.",
        "Chaque conclusion doit rappeler implicitement ou explicitement que la validation humaine est obligatoire.",
        "Retourne seulement le JSON demandé.",
      ].join("\n"),
    schema: insuranceNeedsAiSchema,
    context,
    fallback: () =>
      buildInsuranceNeedsFallback({
        analysisType: context.analysisType,
        clientName: context.clientName,
        missingData: context.missingData,
        recommendedAmount: Number((context.recommendation as { recommendedAmount?: unknown })?.recommendedAmount ?? 0),
        reasoning: String((context.recommendation as { reasoning?: unknown })?.reasoning ?? "Hypothèses à valider par le conseiller."),
      }),
  })
}
