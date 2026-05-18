export const insuranceProductTypes = [
  "LIFE_INSURANCE",
  "DISABILITY_INSURANCE",
  "CRITICAL_ILLNESS",
  "HEALTH_INSURANCE",
  "GROUP_INSURANCE",
  "LONG_TERM_CARE",
  "TRAVEL_INSURANCE",
  "OTHER_INSURANCE",
] as const

export const investmentProductTypes = [
  "RRSP",
  "TFSA",
  "RESP",
  "FHSA",
  "NON_REGISTERED",
  "INVESTMENT",
  "MUTUAL_FUND",
  "SEGREGATED_FUND",
  "GIC",
  "ANNUITY",
  "OTHER_INVESTMENT",
] as const

export const financialProductTypeLabels: Record<string, string> = {
  LIFE_INSURANCE: "Assurance vie",
  DISABILITY_INSURANCE: "Assurance invalidité",
  CRITICAL_ILLNESS: "Maladie grave",
  HEALTH_INSURANCE: "Assurance santé",
  GROUP_INSURANCE: "Assurance collective",
  LONG_TERM_CARE: "Soins longue durée",
  TRAVEL_INSURANCE: "Assurance voyage",
  OTHER_INSURANCE: "Autre assurance",
  RRSP: "REER",
  TFSA: "CELI",
  RESP: "REEE",
  FHSA: "CELIAPP",
  NON_REGISTERED: "Compte non enregistré",
  INVESTMENT: "Placement",
  MUTUAL_FUND: "Fonds commun",
  SEGREGATED_FUND: "Fonds distinct",
  GIC: "CPG",
  ANNUITY: "Rente",
  OTHER_INVESTMENT: "Autre placement",
  OTHER: "Autre",
}

export const financialProductCategoryLabels: Record<string, string> = {
  INSURANCE: "Assurance",
  INVESTMENT: "Placement",
  OTHER: "Autre",
}

export const financialProductStatusLabels: Record<string, string> = {
  ACTIVE: "Actif",
  PENDING: "En attente",
  UNDER_REVIEW: "Proposition en préparation",
  LAPSED: "Échu",
  CANCELLED: "Annulé",
  EXPIRED: "Expiré",
  TRANSFERRED: "Transféré",
  ARCHIVED: "Archivé",
}

export const paymentFrequencyLabels: Record<string, string> = {
  WEEKLY: "Hebdomadaire",
  BIWEEKLY: "Aux deux semaines",
  MONTHLY: "Mensuelle",
  QUARTERLY: "Trimestrielle",
  SEMI_ANNUAL: "Semestrielle",
  ANNUAL: "Annuelle",
  ONE_TIME: "Paiement unique",
  IRREGULAR: "Irrégulière",
  UNKNOWN: "Inconnue",
}

export const commissionTypeLabels: Record<string, string> = {
  FIRST_YEAR: "Première année",
  RENEWAL: "Renouvellement",
  TRAILER: "Suivi",
  FLAT: "Forfaitaire",
  UNKNOWN: "Inconnue",
}

export type FinancialProductSummaryInput = {
  category: string
  status: string
  coverageAmount?: number | null
  accountValue?: number | null
  commissionAmount?: number | null
  renewalAt?: string | Date | null
  nextReviewAt?: string | Date | null
  primaryBeneficiary?: string | null
  documentStatus?: string | null
}

const activeStatuses = new Set(["ACTIVE", "PENDING", "UNDER_REVIEW"])

function daysUntil(date: string | Date | null | undefined) {
  if (!date) return null
  const target = new Date(date).getTime()
  if (Number.isNaN(target)) return null
  return Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24))
}

export function getFinancialProductSummary(products: FinancialProductSummaryInput[]) {
  const activeProducts = products.filter((product) => activeStatuses.has(product.status))
  const upcomingRenewals = activeProducts.filter((product) => {
    const days = daysUntil(product.renewalAt)
    return days !== null && days >= 0 && days <= 30
  })
  const productsNeedingReview = activeProducts.filter((product) => {
    const days = daysUntil(product.nextReviewAt)
    return product.status === "UNDER_REVIEW" || (days !== null && days < 0)
  })

  return {
    activeProductsCount: activeProducts.length,
    totalInsuranceCoverage: activeProducts
      .filter((product) => product.category === "INSURANCE")
      .reduce((sum, product) => sum + (product.coverageAmount ?? 0), 0),
    totalInvestmentValue: activeProducts
      .filter((product) => product.category === "INVESTMENT")
      .reduce((sum, product) => sum + (product.accountValue ?? 0), 0),
    totalEstimatedCommission: activeProducts.reduce(
      (sum, product) => sum + (product.commissionAmount ?? 0),
      0
    ),
    upcomingRenewals,
    productsNeedingReview,
    missingBeneficiaries: activeProducts.filter(
      (product) => product.category === "INSURANCE" && !product.primaryBeneficiary
    ),
    missingDocuments: activeProducts.filter((product) =>
      ["MISSING", "REQUIRED", "PENDING"].includes(product.documentStatus ?? "")
    ),
  }
}

export function getProductAlerts(product: FinancialProductSummaryInput) {
  const alerts: string[] = []
  const renewalDays = daysUntil(product.renewalAt)
  const reviewDays = daysUntil(product.nextReviewAt)

  if (product.category === "INSURANCE" && !product.primaryBeneficiary) {
    alerts.push("Bénéficiaire manquant")
  }
  if (renewalDays !== null && renewalDays >= 0 && renewalDays <= 30) {
    alerts.push("Renouvellement proche")
  }
  if (reviewDays !== null && reviewDays < 0) {
    alerts.push("Révision dépassée")
  }
  if (["MISSING", "REQUIRED", "PENDING"].includes(product.documentStatus ?? "")) {
    alerts.push("Document requis")
  }
  if (product.status === "UNDER_REVIEW") {
    alerts.push("À réviser")
  }

  return alerts
}
