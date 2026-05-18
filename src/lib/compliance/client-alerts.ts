type ClientForAlerts = {
  id: string
  riskProfile?: string | null
  financialGoals?: string | null
  goals?: string | null
  kycCompleted?: boolean | null
  identityVerified?: boolean | null
  consentGiven?: boolean | null
  nextReviewDate?: string | Date | null
  lastContactAt?: string | Date | null
  updatedAt?: string | Date
  documents?: { type: string; status: string; name?: string | null; description?: string | null; originalFileName?: string | null }[]
  products?: { id: string; renewalAt?: string | Date | null; status?: string | null }[]
}

export type ClientComplianceAlert = {
  id: string
  type: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  title: string
  description: string
  actionLabel: string
  actionUrl?: string
}

const fulfilledDocumentStatuses = new Set(["RECEIVED", "VALIDATED", "WAIVED"])

function normalizeDocumentText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function documentSearchText(document: NonNullable<ClientForAlerts["documents"]>[number]) {
  return normalizeDocumentText(
    [document.type, document.name, document.description, document.originalFileName].filter(Boolean).join(" ")
  )
}

function hasDocument(client: ClientForAlerts, matches: string[]) {
  const normalizedMatches = matches.map(normalizeDocumentText)
  return (client.documents ?? []).some((document) => {
    if (!fulfilledDocumentStatuses.has(document.status)) return false
    const text = documentSearchText(document)
    return normalizedMatches.some((match) => text.includes(match))
  })
}

export function getClientComplianceAlerts(client: ClientForAlerts): ClientComplianceAlert[] {
  const alerts: ClientComplianceAlert[] = []

  if (!hasDocument(client, ["KYC", "KYC_FORM", "questionnaire"])) {
    alerts.push({
      id: "missing-kyc",
      type: "DOCUMENT",
      severity: "HIGH",
      title: "Profil client manquant",
      description: "Aucun document de profil client n'est lié au dossier client.",
      actionLabel: "Ajouter le profil client",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (!client.kycCompleted) {
    alerts.push({
      id: "kyc-not-completed",
      type: "COMPLIANCE",
      severity: "HIGH",
      title: "Profil client non complété",
      description: "Le dossier indique que le questionnaire de profil client n'est pas complété.",
      actionLabel: "Compléter le profil client",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (!hasDocument(client, ["GOVERNMENT_ID", "identity", "identite", "piece", "passeport", "passport", "permis"])) {
    alerts.push({
      id: "missing-id",
      type: "DOCUMENT",
      severity: "MEDIUM",
      title: "Pièce d'identité manquante",
      description: "Le dossier ne contient pas de pièce d'identité.",
      actionLabel: "Ajouter document",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (!client.identityVerified) {
    alerts.push({
      id: "identity-not-verified",
      type: "COMPLIANCE",
      severity: "MEDIUM",
      title: "Identité non vérifiée",
      description: "La vérification d'identité doit être confirmée dans le dossier.",
      actionLabel: "Vérifier l'identité",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (!client.consentGiven) {
    alerts.push({
      id: "consent-missing",
      type: "COMPLIANCE",
      severity: "MEDIUM",
      title: "Consentement conformité manquant",
      description: "Le consentement de conformité du dossier n'est pas encore confirmé.",
      actionLabel: "Ajouter le consentement",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (!client.riskProfile || client.riskProfile === "UNKNOWN") {
    alerts.push({
      id: "unknown-risk",
      type: "RISK",
      severity: "HIGH",
      title: "Profil de risque inconnu",
      description: "Le profil de risque doit être complété avant toute recommandation.",
      actionLabel: "Compléter le profil",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (!client.financialGoals && !client.goals) {
    alerts.push({
      id: "missing-goals",
      type: "GOALS",
      severity: "MEDIUM",
      title: "Objectifs financiers manquants",
      description: "Aucun objectif financier n'est renseigné.",
      actionLabel: "Ajouter objectifs",
      actionUrl: `/clients/${client.id}`,
    })
  }

  const renewalSoon = (client.products ?? []).find((product) => {
    if (!product.renewalAt) return false
    const renewalAt = new Date(product.renewalAt).getTime()
    const diffDays = (renewalAt - Date.now()) / (1000 * 60 * 60 * 24)
    return diffDays >= 0 && diffDays <= 30
  })

  if (renewalSoon) {
    alerts.push({
      id: `renewal-${renewalSoon.id}`,
      type: "PRODUCT",
      severity: "MEDIUM",
      title: "Renouvellement proche",
      description: "Un produit arrive à renouvellement dans moins de 30 jours.",
      actionLabel: "Voir produit",
      actionUrl: `/clients/${client.id}`,
    })
  }

  if (client.nextReviewDate) {
    const reviewAt = new Date(client.nextReviewDate).getTime()
    const diffDays = (reviewAt - Date.now()) / (1000 * 60 * 60 * 24)
    if (diffDays < 0) {
      alerts.push({
        id: "review-overdue",
        type: "REVIEW",
        severity: "HIGH",
        title: "Révision annuelle en retard",
        description: "La date de révision est dépassée.",
        actionLabel: "Planifier la révision",
        actionUrl: `/clients/${client.id}`,
      })
    } else if (diffDays <= 30) {
      alerts.push({
        id: "review-soon",
        type: "REVIEW",
        severity: "MEDIUM",
        title: "Révision à venir",
        description: "Une révision client est prévue dans moins de 30 jours.",
        actionLabel: "Voir dossier",
        actionUrl: `/clients/${client.id}`,
      })
    }
  }

  const lastContactSource = client.lastContactAt ?? client.updatedAt
  if (lastContactSource) {
    const diffDays = (Date.now() - new Date(lastContactSource).getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 90) {
      alerts.push({
        id: "inactive-90-days",
        type: "FOLLOW_UP",
        severity: "MEDIUM",
        title: "Aucun suivi récent",
        description: "Aucune interaction récente n'est enregistrée depuis plus de 90 jours.",
        actionLabel: "Créer une tâche",
        actionUrl: `/clients/${client.id}`,
      })
    }
  }

  return alerts
}
