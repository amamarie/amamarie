import { formatProductType } from "@/lib/portfolio/formatters"

type ClientLike = {
  riskProfile?: string | null
  financialGoals?: string | null
  goals?: string | null
  lastContactAt?: string | Date | null
}

type ProductLike = {
  id: string
  type: string
  category: string
  status: string
  accountValue?: number | null
  coverageAmount?: number | null
  primaryBeneficiary?: string | null
  documentStatus?: string | null
  renewalAt?: string | Date | null
  nextReviewAt?: string | Date | null
  lastReviewAt?: string | Date | null
}

type DocumentLike = {
  id: string
  status?: string | null
  name?: string | null
}

type TaskLike = {
  id: string
  status?: string | null
  title?: string | null
}

export type PortfolioAlert = {
  id: string
  type: string
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  title: string
  description: string
  actionLabel: string
}

function daysUntil(value?: string | Date | null) {
  if (!value) return null
  const date = new Date(value).getTime()
  if (Number.isNaN(date)) return null
  return Math.ceil((date - Date.now()) / (1000 * 60 * 60 * 24))
}

export function getPortfolioAlerts(
  client: ClientLike,
  products: ProductLike[],
  documents: DocumentLike[],
  tasks: TaskLike[]
): PortfolioAlert[] {
  const alerts: PortfolioAlert[] = []

  if (!client.riskProfile || client.riskProfile === "UNKNOWN") {
    alerts.push({
      id: "risk-profile",
      type: "COMPLIANCE",
      severity: "HIGH",
      title: "Profil de risque inconnu",
      description: "Le profil de risque du client doit être complété avant toute analyse.",
      actionLabel: "Compléter le profil",
    })
  }

  if (!client.financialGoals && !client.goals) {
    alerts.push({
      id: "financial-goals",
      type: "FOLLOW_UP",
      severity: "MEDIUM",
      title: "Objectifs financiers absents",
      description: "Aucun objectif financier clair n’est inscrit au dossier.",
      actionLabel: "Ajouter les objectifs",
    })
  }

  const lastContactDays = client.lastContactAt
    ? Math.floor((Date.now() - new Date(client.lastContactAt).getTime()) / (1000 * 60 * 60 * 24))
    : null
  if (lastContactDays === null || lastContactDays > 90) {
    alerts.push({
      id: "inactive-client",
      type: "FOLLOW_UP",
      severity: "MEDIUM",
      title: "Client sans suivi récent",
      description: "Le dossier ne montre aucun suivi récent dans les 90 derniers jours.",
      actionLabel: "Créer une tâche de suivi",
    })
  }

  documents
    .filter((document) => ["REQUIRED", "PENDING", "EXPIRED"].includes(document.status ?? ""))
    .forEach((document) => {
      alerts.push({
        id: `document-${document.id}`,
        type: "DOCUMENT",
        severity: document.status === "EXPIRED" ? "HIGH" : "MEDIUM",
        title: "Document à compléter",
        description: `${document.name ?? "Un document"} est requis, en attente ou expiré.`,
        actionLabel: "Vérifier les documents",
      })
    })

  products.forEach((product) => {
    const productName = formatProductType(product.type)
    const renewalDays = daysUntil(product.renewalAt)
    const reviewDays = daysUntil(product.nextReviewAt)
    const lastReviewDays = product.lastReviewAt
      ? Math.floor((Date.now() - new Date(product.lastReviewAt).getTime()) / (1000 * 60 * 60 * 24))
      : null

    if (product.category === "INSURANCE" && !product.primaryBeneficiary) {
      alerts.push({
        id: `beneficiary-${product.id}`,
        type: "COMPLIANCE",
        severity: "HIGH",
        title: "Bénéficiaire manquant",
        description: `${productName} n’a pas de bénéficiaire principal enregistré.`,
        actionLabel: "Ajouter bénéficiaire",
      })
    }

    if (product.category === "INSURANCE" && !product.coverageAmount) {
      alerts.push({
        id: `coverage-${product.id}`,
        type: "PRODUCT",
        severity: "MEDIUM",
        title: "Couverture absente",
        description: `${productName} n’a pas de montant de couverture renseigné.`,
        actionLabel: "Mettre à jour le produit",
      })
    }

    if (product.category === "INVESTMENT" && !product.accountValue) {
      alerts.push({
        id: `value-${product.id}`,
        type: "PRODUCT",
        severity: "MEDIUM",
        title: "Valeur de placement absente",
        description: `${productName} n’a pas de valeur actuelle renseignée.`,
        actionLabel: "Mettre à jour la valeur",
      })
    }

    if (renewalDays !== null && renewalDays >= 0 && renewalDays <= 30) {
      alerts.push({
        id: `renewal-${product.id}`,
        type: "RENEWAL",
        severity: "MEDIUM",
        title: "Renouvellement proche",
        description: `${productName} arrive à renouvellement dans ${renewalDays} jours.`,
        actionLabel: "Créer un suivi",
      })
    }

    if ((reviewDays !== null && reviewDays < 0) || (lastReviewDays !== null && lastReviewDays > 365)) {
      alerts.push({
        id: `review-${product.id}`,
        type: "REVIEW",
        severity: "MEDIUM",
        title: "Révision annuelle due",
        description: `${productName} doit être révisé avec le client.`,
        actionLabel: "Créer une tâche de révision",
      })
    }
  })

  tasks
    .filter((task) => task.status === "OVERDUE")
    .forEach((task) => {
      alerts.push({
        id: `task-${task.id}`,
        type: "TASK",
        severity: "HIGH",
        title: "Tâche en retard",
        description: task.title ?? "Une tâche de suivi est en retard.",
        actionLabel: "Voir les tâches",
      })
    })

  return alerts
}
