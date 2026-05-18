import { prudentRationale } from "@/lib/cross-sell/copy"
import { confidenceFromScore, estimatePriority } from "@/lib/cross-sell/scoring"
import type { CrossSellCandidate, CrossSellContext, CrossSellPriority } from "@/lib/cross-sell/types"

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

function ageFromDate(value?: Date | string | null) {
  if (!value) return null
  const birth = new Date(value)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--
  return age
}

function withScore(candidate: Omit<CrossSellCandidate, "confidence"> & { score: number; priority?: CrossSellPriority }): CrossSellCandidate {
  return {
    ...candidate,
    priority: candidate.priority ?? estimatePriority({}).priority,
    confidence: confidenceFromScore(candidate.score),
    metadata: {
      ...(typeof candidate.metadata === "object" && candidate.metadata !== null ? candidate.metadata : {}),
      score: candidate.score,
    },
  }
}

export function runCrossSellRules(context: CrossSellContext): CrossSellCandidate[] {
  const { client, products } = context
  const candidates: CrossSellCandidate[] = []
  const activeProducts = products.filter(isActive)
  const hasProduct = (type: string) => activeProducts.some((product) => product.type === type)
  const hasInsuranceOrDisability = activeProducts.some((product) => ["DISABILITY_INSURANCE", "LIFE_INSURANCE"].includes(product.type))
  const dependents = client.dependentsCount ?? client.dependents ?? 0
  const income = client.annualIncome ?? client.approximateIncome
  const isSelfEmployed = client.isSelfEmployed || client.employmentStatus === "SELF_EMPLOYED"
  const age = ageFromDate(client.dateOfBirth)
  const lastContactDays = daysSince(client.lastContactAt)

  if (dependents > 0 && !hasProduct("LIFE_INSURANCE")) {
    const score = estimatePriority({ evidentNeed: true, missingProduct: true, linkedGoal: true, commercialPriority: true }).score
    candidates.push(withScore({
      category: "PROTECTION",
      priority: "HIGH",
      score,
      ruleKey: "cross_sell_family_protection",
      title: "Protection familiale à valider",
      description: "Ce client a des personnes à charge et aucune assurance vie active n’est enregistrée dans le dossier.",
      rationale: prudentRationale("La présence de personnes à charge peut justifier une discussion sur la protection familiale."),
      actionLabel: "Créer une tâche de discussion",
      suggestedDiscussionTopic: "Validation des besoins de protection familiale",
      relatedProductType: "LIFE_INSURANCE",
      metadata: { dependentsCount: dependents },
    }))
  }

  if (["EMPLOYED", "SELF_EMPLOYED"].includes(client.employmentStatus ?? "") && income && !hasProduct("DISABILITY_INSURANCE")) {
    const score = estimatePriority({
      evidentNeed: true,
      missingProduct: true,
      incomeKnown: true,
      commercialPriority: isSelfEmployed,
    }).score
    candidates.push(withScore({
      category: isSelfEmployed ? "BUSINESS_OWNER" : "PROTECTION",
      priority: isSelfEmployed ? "HIGH" : "MEDIUM",
      score,
      ruleKey: "cross_sell_income_protection",
      title: "Protection du revenu à valider",
      description: "Le client semble dépendre de son revenu d’emploi, mais aucune assurance invalidité active n’est enregistrée.",
      rationale: prudentRationale("Le conseiller peut valider si une discussion sur la protection du revenu est pertinente."),
      actionLabel: "Valider besoin de protection revenu",
      suggestedDiscussionTopic: "Protection du revenu et continuité financière",
      relatedProductType: "DISABILITY_INSURANCE",
      metadata: { employmentStatus: client.employmentStatus, annualIncome: income },
    }))
  }

  if (age !== null && age >= 30 && age <= 60 && !hasProduct("CRITICAL_ILLNESS")) {
    const score = estimatePriority({ missingProduct: true, insufficientData: !income }).score
    candidates.push(withScore({
      category: "PROTECTION",
      priority: score >= 40 ? "MEDIUM" : "LOW",
      score,
      ruleKey: "cross_sell_critical_illness",
      title: "Maladie grave à discuter",
      description: "Aucune protection maladie grave active n’est enregistrée. Le conseiller peut valider si ce sujet est pertinent.",
      rationale: prudentRationale("Cette piste sert seulement à préparer une conversation possible."),
      actionLabel: "Ajouter au prochain rendez-vous",
      suggestedDiscussionTopic: "Protection maladie grave",
      relatedProductType: "CRITICAL_ILLNESS",
      metadata: { age },
    }))
  }

  if (client.primaryGoal === "RETIREMENT" && !hasProduct("RRSP")) {
    const score = estimatePriority({ missingProduct: true, linkedGoal: true, incomeKnown: Boolean(income) }).score
    candidates.push(withScore({
      category: "RETIREMENT",
      priority: "MEDIUM",
      score,
      ruleKey: "cross_sell_retirement_rrsp",
      title: "Sujet REER à valider",
      description: "Le client a un objectif retraite, mais aucun REER actif n’est enregistré.",
      rationale: prudentRationale("Le conseiller peut vérifier si ce sujet est pertinent selon le revenu, les objectifs et la situation fiscale du client."),
      actionLabel: "Discuter stratégie retraite",
      suggestedDiscussionTopic: "Objectifs de retraite et véhicules d’épargne",
      relatedProductType: "RRSP",
    }))
  }

  if (["WEALTH_BUILDING", "SAVINGS"].includes(client.primaryGoal ?? "") && !hasProduct("TFSA")) {
    const score = estimatePriority({ missingProduct: true, linkedGoal: true }).score
    candidates.push(withScore({
      category: "INVESTMENT",
      priority: score >= 40 ? "MEDIUM" : "LOW",
      score,
      ruleKey: "cross_sell_tfsa_savings",
      title: "Sujet CELI à valider",
      description: "Aucun CELI actif n’est enregistré. Le conseiller peut valider si ce véhicule est pertinent selon les objectifs du client.",
      rationale: prudentRationale("Aucune recommandation de produit spécifique n’est générée."),
      actionLabel: "Ajouter au prochain suivi",
      suggestedDiscussionTopic: "Accumulation et fiscalité de l’épargne",
      relatedProductType: "TFSA",
    }))
  }

  if ((client.hasChildren || dependents > 0) && !hasProduct("RESP")) {
    const score = estimatePriority({ evidentNeed: true, missingProduct: true }).score
    candidates.push(withScore({
      category: "FAMILY_NEEDS",
      priority: score >= 40 ? "MEDIUM" : "LOW",
      score,
      ruleKey: "cross_sell_family_resp",
      title: "Épargne études à valider",
      description: "Le client semble avoir des enfants ou personnes à charge. Aucun REEE actif n’est enregistré.",
      rationale: prudentRationale("Le conseiller peut valider si l’épargne études doit faire partie de la discussion."),
      actionLabel: "Discuter épargne études",
      relatedProductType: "RESP",
      metadata: { hasChildren: client.hasChildren, dependentsCount: dependents },
    }))
  }

  if (client.primaryGoal === "HOME_PURCHASE" && !hasProduct("FHSA")) {
    const score = estimatePriority({ missingProduct: true, linkedGoal: true }).score
    candidates.push(withScore({
      category: "TAX_EFFICIENCY",
      priority: "MEDIUM",
      score,
      ruleKey: "cross_sell_home_purchase_fhsa",
      title: "Sujet CELIAPP à valider",
      description: "Le client indique un objectif d’achat immobilier, mais aucun CELIAPP actif n’est enregistré.",
      rationale: prudentRationale("Le conseiller doit valider l’admissibilité et la pertinence avec le client."),
      actionLabel: "Valider admissibilité et intérêt",
      relatedProductType: "FHSA",
    }))
  }

  if (isSelfEmployed && !hasInsuranceOrDisability) {
    const score = estimatePriority({ evidentNeed: true, missingProduct: true, incomeKnown: Boolean(income), commercialPriority: true }).score
    candidates.push(withScore({
      category: "BUSINESS_OWNER",
      priority: "HIGH",
      score,
      ruleKey: "cross_sell_business_owner_protection",
      title: "Protection entrepreneur à valider",
      description: "Le client est travailleur autonome ou entrepreneur. Le conseiller peut valider les besoins liés à la protection du revenu et de l’entreprise.",
      rationale: prudentRationale("Cette piste ne conclut pas à un besoin; elle suggère une discussion structurée."),
      actionLabel: "Planifier discussion entreprise",
      suggestedDiscussionTopic: "Protection du revenu et continuité des activités",
      metadata: { employmentStatus: client.employmentStatus, isSelfEmployed },
    }))
  }

  if (client.status === "ACTIVE" && lastContactDays !== null && lastContactDays > 90) {
    const score = estimatePriority({ noRecentContact: true, commercialPriority: lastContactDays > 180 }).score
    candidates.push(withScore({
      category: "REVIEW_OPPORTUNITY",
      priority: lastContactDays > 180 ? "HIGH" : "MEDIUM",
      score,
      ruleKey: "cross_sell_client_no_recent_followup",
      title: "Suivi client à planifier",
      description: "Aucun suivi récent n’est enregistré pour ce client.",
      rationale: prudentRationale("Une discussion de suivi peut aider à maintenir le dossier à jour."),
      actionLabel: "Créer tâche de suivi",
      metadata: { daysSinceLastContact: lastContactDays },
    }))
  }

  activeProducts.forEach((product) => {
    const renewalDays = daysUntil(product.renewalAt)
    const reviewDays = daysSince(product.lastReviewAt)

    if (renewalDays !== null && renewalDays >= 0 && renewalDays <= 30) {
      const score = estimatePriority({ evidentNeed: true, commercialPriority: renewalDays <= 15 }).score
      candidates.push(withScore({
        category: "REVIEW_OPPORTUNITY",
        priority: renewalDays <= 15 ? "HIGH" : "MEDIUM",
        score,
        ruleKey: "cross_sell_product_renewal_soon",
        title: "Renouvellement à préparer",
        description: "Un produit arrive bientôt à renouvellement. Le conseiller peut planifier une révision.",
        rationale: prudentRationale("Cette piste vise à organiser le suivi avant l’échéance."),
        actionLabel: "Créer tâche renouvellement",
        relatedProductId: product.id,
        relatedProductType: product.type,
        metadata: { productId: product.id, daysUntilRenewal: renewalDays },
      }))
    }

    if (product.category === "INVESTMENT" && reviewDays !== null && reviewDays > 365) {
      const score = estimatePriority({ evidentNeed: true, commercialPriority: reviewDays > 540 }).score
      candidates.push(withScore({
        category: "REVIEW_OPPORTUNITY",
        priority: "MEDIUM",
        score,
        ruleKey: "cross_sell_investment_review_due",
        title: "Placement à réviser",
        description: "Ce placement n’a pas été révisé récemment.",
        rationale: prudentRationale("Aucune projection de rendement n’est fournie."),
        actionLabel: "Créer tâche de révision",
        relatedProductId: product.id,
        relatedProductType: product.type,
        metadata: { productId: product.id, daysSinceLastReview: reviewDays },
      }))
    }

    if (product.category === "INSURANCE" && product.type === "LIFE_INSURANCE" && !product.primaryBeneficiary) {
      const score = estimatePriority({ evidentNeed: true, commercialPriority: true }).score
      candidates.push(withScore({
        category: "FAMILY_NEEDS",
        priority: "HIGH",
        score,
        ruleKey: "cross_sell_missing_beneficiary",
        title: "Bénéficiaire à compléter",
        description: "Une assurance vie active n’a pas de bénéficiaire principal enregistré.",
        rationale: prudentRationale("Le conseiller peut confirmer ou compléter l’information avec le client."),
        actionLabel: "Compléter bénéficiaire",
        relatedProductId: product.id,
        relatedProductType: product.type,
        metadata: { productId: product.id },
      }))
    }
  })

  return candidates
}
