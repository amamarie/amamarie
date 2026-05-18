import { confidence, priorityFromDaysUntil, priorityFromIncome } from "@/lib/recommendations/scoring"
import type { RecommendationCandidate, RecommendationContext } from "@/lib/recommendations/types"

const activeStatuses = new Set(["ACTIVE", "PENDING", "UNDER_REVIEW"])

function isActive(product: { status: string }) {
  return activeStatuses.has(product.status)
}

function daysSince(value?: Date | string | null) {
  if (!value) return null
  const date = new Date(value).getTime()
  if (Number.isNaN(date)) return null
  return Math.floor((Date.now() - date) / (1000 * 60 * 60 * 24))
}

function daysUntil(value?: Date | string | null) {
  if (!value) return null
  const date = new Date(value).getTime()
  if (Number.isNaN(date)) return null
  return Math.ceil((date - Date.now()) / (1000 * 60 * 60 * 24))
}

function adult(dateOfBirth?: Date | string | null) {
  if (!dateOfBirth) return false
  return daysSince(dateOfBirth) !== null && daysSince(dateOfBirth)! >= 18 * 365
}

export function runRecommendationRules(context: RecommendationContext): RecommendationCandidate[] {
  const { client, products } = context
  const candidates: RecommendationCandidate[] = []
  const dependents = client.dependentsCount ?? client.dependents ?? 0
  const income = client.annualIncome ?? client.approximateIncome
  const activeProducts = products.filter(isActive)
  const hasLifeInsurance = activeProducts.some((product) => product.type === "LIFE_INSURANCE")
  const hasDisability = activeProducts.some((product) => product.type === "DISABILITY_INSURANCE")
  const hasTfsa = activeProducts.some((product) => product.type === "TFSA")
  const hasRrsp = activeProducts.some((product) => product.type === "RRSP")
  const lastContactDays = daysSince(client.lastContactAt)

  if (dependents > 0 && !hasLifeInsurance) {
    candidates.push({
      type: "PROTECTION",
      priority: "HIGH",
      ruleKey: "missing_life_insurance_with_dependents",
      title: "Besoin de protection familiale à valider",
      description: "Ce client a des personnes à charge et aucune assurance vie active n’est enregistrée dans le dossier.",
      rationale: "À discuter avec le client. Cette piste ne constitue pas une recommandation financière.",
      actionLabel: "Créer une tâche de discussion",
      confidence: confidence(0.72, [Math.min(dependents, 3) * 0.04]),
      metadata: { dependentsCount: dependents, suggestedTaskTitle: "Valider les besoins de protection familiale" },
    })
  }

  if (["SELF_EMPLOYED", "EMPLOYED"].includes(client.employmentStatus ?? "") && income && !hasDisability) {
    candidates.push({
      type: "PROTECTION",
      priority: priorityFromIncome(income),
      ruleKey: "missing_disability_income_dependent",
      title: "Protection du revenu à valider",
      description: "Le client semble dépendre de son revenu d’emploi, mais aucune assurance invalidité active n’est enregistrée.",
      rationale: "Le conseiller peut valider si une discussion sur la protection du revenu est pertinente.",
      actionLabel: "Créer une tâche de validation",
      confidence: confidence(0.68, [income >= 100000 ? 0.08 : 0]),
      metadata: { annualIncome: income, employmentStatus: client.employmentStatus },
    })
  }

  if (!client.riskProfile || client.riskProfile === "UNKNOWN") {
    candidates.push({
      type: "COMPLIANCE",
      priority: "MEDIUM",
      ruleKey: "missing_risk_profile",
      title: "Profil de risque à compléter",
      description: "Le profil de risque du client n’est pas renseigné.",
      rationale: "Information requise pour maintenir un dossier complet.",
      actionLabel: "Compléter le profil",
      confidence: 0.9,
    })
  }

  if (!client.financialGoals && !client.primaryGoal && !client.goals) {
    candidates.push({
      type: "DATA_QUALITY",
      priority: "MEDIUM",
      ruleKey: "missing_financial_goals",
      title: "Objectifs financiers absents",
      description: "Les objectifs financiers du client ne sont pas renseignés.",
      rationale: "À compléter avec le client pour mieux préparer les suivis.",
      actionLabel: "Ajouter les objectifs",
      confidence: 0.86,
    })
  }

  if (lastContactDays !== null && lastContactDays > 90) {
    candidates.push({
      type: "FOLLOW_UP",
      priority: lastContactDays > 180 ? "HIGH" : "MEDIUM",
      ruleKey: "client_no_contact_90_days",
      title: "Suivi client à planifier",
      description: "Ce client n’a pas de contact récent enregistré depuis plus de 90 jours.",
      rationale: "Une discussion de suivi pourrait être planifiée par le conseiller.",
      actionLabel: "Créer une tâche de suivi",
      confidence: confidence(0.74, [lastContactDays > 180 ? 0.12 : 0]),
      metadata: { daysSinceLastContact: lastContactDays },
    })
  }

  activeProducts.forEach((product) => {
    const renewalDays = daysUntil(product.renewalAt)
    const reviewDays = daysSince(product.lastReviewAt)

    if (reviewDays !== null && reviewDays > 365) {
      candidates.push({
        type: "FOLLOW_UP",
        priority: "MEDIUM",
        ruleKey: "annual_review_due",
        relatedProductId: product.id,
        title: "Révision annuelle à planifier",
        description: "Ce dossier ou produit n’a pas été révisé récemment.",
        rationale: "À réviser avec le conseiller avant toute conclusion.",
        actionLabel: "Créer une tâche de révision",
        confidence: 0.8,
        metadata: { productId: product.id, daysSinceLastReview: reviewDays },
      })
    }

    if (renewalDays !== null && renewalDays >= 0 && renewalDays <= 30) {
      candidates.push({
        type: "FOLLOW_UP",
        priority: priorityFromDaysUntil(renewalDays, "HIGH"),
        ruleKey: "product_renewal_soon",
        relatedProductId: product.id,
        title: "Renouvellement proche",
        description: "Un produit actif arrive à renouvellement dans moins de 30 jours.",
        rationale: "Le conseiller peut préparer un suivi de renouvellement.",
        actionLabel: "Créer une tâche de renouvellement",
        confidence: 0.88,
        metadata: { productId: product.id, daysUntilRenewal: renewalDays, renewalDate: product.renewalAt?.toString() },
      })
    }

    if (product.category === "INSURANCE" && product.type === "LIFE_INSURANCE" && !product.primaryBeneficiary) {
      candidates.push({
        type: "COMPLIANCE",
        priority: "HIGH",
        ruleKey: "missing_life_insurance_beneficiary",
        relatedProductId: product.id,
        title: "Bénéficiaire d’assurance vie à valider",
        description: "Une assurance vie active n’a pas de bénéficiaire principal enregistré.",
        rationale: "Information à compléter ou à valider avec le client.",
        actionLabel: "Ajouter bénéficiaire",
        confidence: 0.92,
        metadata: { productId: product.id },
      })
    }

    if (["REQUIRED", "MISSING"].includes(product.documentStatus ?? "")) {
      candidates.push({
        type: "DATA_QUALITY",
        priority: "MEDIUM",
        ruleKey: "missing_product_document",
        relatedProductId: product.id,
        title: "Document produit à compléter",
        description: "Un produit indique un document requis ou manquant.",
        rationale: "À compléter pour améliorer la qualité du dossier.",
        actionLabel: "Demander le document",
        confidence: 0.78,
        metadata: { productId: product.id, documentStatus: product.documentStatus },
      })
    }

    if (product.category === "INVESTMENT" && product.accountValue && reviewDays !== null && reviewDays > 365) {
      candidates.push({
        type: "INVESTMENT_REVIEW",
        priority: reviewDays > 540 ? "MEDIUM" : "LOW",
        ruleKey: "investment_value_not_recently_reviewed",
        relatedProductId: product.id,
        title: "Valeur de placement à mettre à jour",
        description: "Un placement avec valeur enregistrée n’a pas été révisé depuis plus de 12 mois.",
        rationale: "À valider avec le conseiller. Aucune projection de performance n’est fournie.",
        actionLabel: "Créer une tâche de mise à jour",
        confidence: 0.66,
        metadata: { productId: product.id, daysSinceLastReview: reviewDays },
      })
    }
  })

  if (adult(client.dateOfBirth) && !hasTfsa && ["WEALTH_BUILDING", "RETIREMENT"].includes(client.primaryGoal ?? "")) {
    candidates.push({
      type: "CROSS_SELL_OPPORTUNITY",
      priority: "LOW",
      ruleKey: "tfsa_opportunity_to_validate",
      title: "CELI à discuter si pertinent",
      description: "Aucun CELI n’est enregistré. Le conseiller peut vérifier si ce sujet est pertinent selon la situation du client.",
      rationale: "Piste de conversation interne seulement.",
      actionLabel: "Créer une tâche de discussion",
      confidence: 0.55,
    })
  }

  if (income && income >= 75000 && !hasRrsp && ["RETIREMENT", "TAX_OPTIMIZATION"].includes(client.primaryGoal ?? "")) {
    candidates.push({
      type: "CROSS_SELL_OPPORTUNITY",
      priority: income >= 120000 ? "MEDIUM" : "LOW",
      ruleKey: "rrsp_opportunity_to_validate",
      title: "REER à discuter si pertinent",
      description: "Aucun REER n’est enregistré. Le conseiller peut vérifier si ce sujet doit être abordé.",
      rationale: "Le moteur ne recommande pas l’achat d’un produit; il suggère une validation.",
      actionLabel: "Créer une tâche de discussion",
      confidence: confidence(0.54, [income >= 120000 ? 0.08 : 0]),
      metadata: { annualIncome: income },
    })
  }

  return candidates
}
