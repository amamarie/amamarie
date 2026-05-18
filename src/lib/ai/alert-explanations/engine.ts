import { Prisma } from "@prisma/client"

import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"

import { createAlertExplanationInputHash, findCachedAlertExplanation } from "./cache"
import { buildAlertExplanationContext } from "./context"
import { aiAlertExplanationOutputSchema, type AiAlertExplanationOutput } from "./schemas"
import { validateAiAlertExplanationSafety } from "./safety"
import { AI_ALERT_MODEL_NAME, AI_ALERT_PROMPT_VERSION, type AlertExplanationContext } from "./types"

const DISCLAIMER = "Cette analyse est une aide interne et ne remplace pas l’évaluation professionnelle du conseiller."

export class AiRateLimitError extends Error {
  constructor(message = "Limite de génération atteinte. Réessayez plus tard.") {
    super(message)
    this.name = "AiRateLimitError"
  }
}

function daysSince(date: Date | null) {
  if (!date) return null
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

function getMissingData(context: AlertExplanationContext) {
  const type = context.alert.type
  const missing = new Set<string>()

  if (type.includes("KYC")) missing.add("Profil client à jour")
  if (type.includes("DOCUMENT")) missing.add("Document requis ou document à jour")
  if (type.includes("CONSENT")) missing.add("Consentement actif")
  if (type.includes("RISK") || !context.client.riskProfile) missing.add("Profil de risque")
  if (type.includes("OBJECTIVE") || !context.client.financialGoals) missing.add("Objectifs financiers")
  if (type.includes("SOURCE_OF_FUNDS") || !context.kyc?.sourceOfFunds) missing.add("Source des fonds")
  if (type.includes("ANNUAL_REVIEW")) missing.add("Date de révision annuelle")
  if (type.includes("BENEFICIARY")) missing.add("Bénéficiaire principal")

  return Array.from(missing)
}

function priorityFromSeverity(severity: string) {
  if (severity === "CRITICAL") return "CRITICAL"
  if (severity === "HIGH") return "HIGH"
  if (severity === "MEDIUM") return "MEDIUM"
  return "LOW"
}

function buildSafeExplanation(context: AlertExplanationContext): AiAlertExplanationOutput {
  const clientName = `${context.client.firstName} ${context.client.lastName}`
  const missingData = getMissingData(context)
  const daysWithoutContact = daysSince(context.client.lastContactAt)
  const priority = priorityFromSeverity(context.alert.severity)

  const actions: AiAlertExplanationOutput["suggestedActions"] = [
    {
      label: "Créer une tâche de suivi",
      type: "CREATE_TASK",
      priority,
    },
    {
      label: "Ajouter une note interne",
      type: "CREATE_NOTE",
      priority: priority === "CRITICAL" ? "HIGH" : "LOW",
    },
  ]

  if (context.alert.type.includes("DOCUMENT")) {
    actions.unshift({
      label: "Créer une tâche de demande de document",
      type: "REQUEST_DOCUMENT",
      priority,
    })
  }

  if (context.alert.type.includes("REVIEW") || context.alert.type.includes("KYC")) {
    actions.unshift({
      label: "Planifier une révision du dossier",
      type: "SCHEDULE_REVIEW",
      priority,
    })
  }

  return {
    summary: context.alert.title,
    whyItTriggered: `Cette alerte a été déclenchée selon les règles internes du cabinet: ${context.alert.description}`,
    clientContext: `${clientName} est un client au statut ${context.client.status}. ${context.client.age ? `Âge approximatif: ${context.client.age} ans. ` : ""}${daysWithoutContact === null ? "Aucun dernier contact n’est renseigné." : `Dernier contact enregistré il y a ${daysWithoutContact} jour${daysWithoutContact > 1 ? "s" : ""}.`} Score profil client actuel: ${context.kyc?.complianceScore ?? "non disponible"}.`,
    missingData,
    suggestedActions: actions,
    advisorNoteDraft: `Alerte à valider: ${context.alert.title}. Vérifier les données du dossier et documenter le suivi effectué.`,
    clientMessageDraft: "Bonjour, nous aimerions mettre à jour certaines informations de votre dossier afin de nous assurer qu’elles sont exactes. Seriez-vous disponible pour un court suivi?",
    riskLevelExplanation: `La priorité ${context.alert.severity} provient du niveau d’alerte configuré dans le CRM. Le conseiller devrait valider le contexte avant toute décision.`,
    complianceDisclaimer: DISCLAIMER,
  }
}

async function enforceRateLimits({ organizationId, alertId, userId }: { organizationId: string; alertId: string; userId: string }) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [hourlyCount, dailyAlertCount] = await Promise.all([
    prisma.alertAiExplanation.count({
      where: { organizationId, generatedById: userId, createdAt: { gte: oneHourAgo }, status: { in: ["GENERATED", "REVIEWED"] } },
    }),
    prisma.alertAiExplanation.count({
      where: { organizationId, alertId, createdAt: { gte: startOfDay }, status: { in: ["GENERATED", "REVIEWED"] } },
    }),
  ])

  if (hourlyCount >= 10 || dailyAlertCount >= 3) {
    throw new AiRateLimitError()
  }
}

export async function generateAlertAiExplanation({
  organizationId,
  alertId,
  userId,
}: {
  organizationId: string
  alertId: string
  userId: string
}) {
  const context = await buildAlertExplanationContext({ organizationId, alertId, userId })
  const inputHash = createAlertExplanationInputHash(context)
  const cached = await findCachedAlertExplanation({ organizationId, alertId, inputHash })
  if (cached) return cached

  await enforceRateLimits({ organizationId, alertId, userId })

  try {
    const parsed = aiAlertExplanationOutputSchema.parse(buildSafeExplanation(context))
    const safety = validateAiAlertExplanationSafety(parsed)
    if (!safety.ok) {
      throw new Error(safety.reason ?? "Réponse IA non sécuritaire.")
    }

    const explanation = await prisma.alertAiExplanation.create({
      data: {
        organizationId,
        alertId,
        clientId: context.client.id,
        generatedById: userId,
        status: "GENERATED",
        summary: parsed.summary,
        whyItTriggered: parsed.whyItTriggered,
        clientContext: parsed.clientContext,
        missingData: parsed.missingData as Prisma.InputJsonValue,
        suggestedActions: parsed.suggestedActions as Prisma.InputJsonValue,
        advisorNoteDraft: parsed.advisorNoteDraft,
        clientMessageDraft: parsed.clientMessageDraft,
        riskLevelExplanation: parsed.riskLevelExplanation,
        complianceDisclaimer: parsed.complianceDisclaimer,
        modelName: AI_ALERT_MODEL_NAME,
        promptVersion: AI_ALERT_PROMPT_VERSION,
        inputHash,
      },
    })

    await createCrmActivity({
      organizationId,
      userId,
      clientId: context.client.id,
      type: "AI_ALERT_EXPLANATION_GENERATED",
      title: "Explication IA générée",
      description: context.alert.title,
    })

    return explanation
  } catch (error) {
    await prisma.alertAiExplanation.create({
      data: {
        organizationId,
        alertId,
        clientId: context.client.id,
        generatedById: userId,
        status: "FAILED",
        summary: "Explication non générée",
        whyItTriggered: "Impossible de générer une explication fiable pour cette alerte.",
        complianceDisclaimer: DISCLAIMER,
        modelName: AI_ALERT_MODEL_NAME,
        promptVersion: AI_ALERT_PROMPT_VERSION,
        inputHash,
        failedAt: new Date(),
        error: error instanceof Error ? error.message : "Erreur inconnue",
      },
    })

    await createCrmActivity({
      organizationId,
      userId,
      clientId: context.client.id,
      type: "AI_ALERT_EXPLANATION_FAILED",
      title: "Explication IA échouée",
      description: context.alert.title,
    })

    throw error
  }
}
