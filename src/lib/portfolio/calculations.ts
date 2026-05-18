type Product = {
  id: string
  category: string
  type: string
  status: string
  company?: string | null
  premium?: number | null
  premiumFrequency?: string | null
  coverageAmount?: number | null
  accountValue?: number | null
  contributionAmount?: number | null
  contributionFrequency?: string | null
  commissionAmount?: number | null
  renewalAt?: string | Date | null
  maturityAt?: string | Date | null
  lastReviewAt?: string | Date | null
  nextReviewAt?: string | Date | null
  primaryBeneficiary?: string | null
  documentStatus?: string | null
}

type ClientLike = {
  riskProfile?: string | null
  financialGoals?: string | null
  goals?: string | null
  lastContactAt?: string | Date | null
  kycCompleted?: boolean
  identityVerified?: boolean
  consentGiven?: boolean
}

type DocumentLike = {
  status?: string | null
}

type TaskLike = {
  status?: string | null
}

const activeStatuses = new Set(["ACTIVE", "PENDING", "UNDER_REVIEW"])
const insuranceTypes = new Set([
  "LIFE_INSURANCE",
  "DISABILITY_INSURANCE",
  "CRITICAL_ILLNESS",
  "HEALTH_INSURANCE",
  "GROUP_INSURANCE",
  "LONG_TERM_CARE",
  "TRAVEL_INSURANCE",
  "OTHER_INSURANCE",
])

function isActive(product: Product) {
  return activeStatuses.has(product.status)
}

function daysUntil(value?: string | Date | null) {
  if (!value) return null
  const date = new Date(value).getTime()
  if (Number.isNaN(date)) return null
  return Math.ceil((date - Date.now()) / (1000 * 60 * 60 * 24))
}

function monthlyEquivalent(amount?: number | null, frequency?: string | null) {
  if (!amount) return 0
  switch (frequency) {
    case "WEEKLY":
      return amount * 52 / 12
    case "BIWEEKLY":
      return amount * 26 / 12
    case "QUARTERLY":
      return amount / 3
    case "SEMI_ANNUAL":
      return amount / 6
    case "ANNUAL":
      return amount / 12
    case "ONE_TIME":
    case "IRREGULAR":
    case "UNKNOWN":
    default:
      return frequency === "MONTHLY" ? amount : 0
  }
}

function annualEquivalent(amount?: number | null, frequency?: string | null) {
  return monthlyEquivalent(amount, frequency) * 12
}

export function calculateTotalInvestmentValue(products: Product[]) {
  return products
    .filter((product) => isActive(product) && product.category === "INVESTMENT")
    .reduce((sum, product) => sum + (product.accountValue ?? 0), 0)
}

export function calculateTotalInsuranceCoverage(products: Product[]) {
  return products
    .filter((product) => isActive(product) && product.category === "INSURANCE")
    .reduce((sum, product) => sum + (product.coverageAmount ?? 0), 0)
}

export function calculateTotalAnnualPremium(products: Product[]) {
  return products
    .filter((product) => isActive(product) && product.category === "INSURANCE")
    .reduce((sum, product) => sum + annualEquivalent(product.premium, product.premiumFrequency), 0)
}

export function calculateTotalMonthlyContribution(products: Product[]) {
  return products
    .filter((product) => isActive(product) && product.category === "INVESTMENT")
    .reduce((sum, product) => sum + monthlyEquivalent(product.contributionAmount, product.contributionFrequency), 0)
}

export function calculateTotalEstimatedCommission(products: Product[]) {
  return products
    .filter(isActive)
    .reduce((sum, product) => sum + (product.commissionAmount ?? 0), 0)
}

export function calculateAssetAllocation(products: Product[]) {
  const investments = products.filter((product) => isActive(product) && product.category === "INVESTMENT")
  const total = calculateTotalInvestmentValue(investments)
  const grouped = new Map<string, { type: string; value: number; products: number; companies: Set<string> }>()

  investments.forEach((product) => {
    const current = grouped.get(product.type) ?? {
      type: product.type,
      value: 0,
      products: 0,
      companies: new Set<string>(),
    }
    current.value += product.accountValue ?? 0
    current.products += 1
    if (product.company) current.companies.add(product.company)
    grouped.set(product.type, current)
  })

  return Array.from(grouped.values()).map((item) => ({
    type: item.type,
    value: item.value,
    products: item.products,
    companies: Array.from(item.companies),
    percentage: total > 0 ? (item.value / total) * 100 : 0,
  }))
}

export function calculateUpcomingRenewals(products: Product[], withinDays = 90) {
  return products
    .filter((product) => {
      const days = daysUntil(product.renewalAt)
      return isActive(product) && days !== null && days >= 0 && days <= withinDays
    })
    .sort((a, b) => new Date(a.renewalAt ?? 0).getTime() - new Date(b.renewalAt ?? 0).getTime())
}

export function calculateProductsNeedingReview(products: Product[]) {
  return products.filter((product) => {
    const nextReviewDays = daysUntil(product.nextReviewAt)
    const lastReviewDays = product.lastReviewAt
      ? Math.floor((Date.now() - new Date(product.lastReviewAt).getTime()) / (1000 * 60 * 60 * 24))
      : null
    return (
      isActive(product) &&
      (product.status === "UNDER_REVIEW" ||
        (nextReviewDays !== null && nextReviewDays < 0) ||
        (lastReviewDays !== null && lastReviewDays > 365))
    )
  })
}

export function calculateMissingBeneficiaries(products: Product[]) {
  return products.filter((product) => isActive(product) && insuranceTypes.has(product.type) && !product.primaryBeneficiary)
}

export function calculatePortfolioSummary(products: Product[]) {
  const activeProducts = products.filter(isActive)
  const upcomingRenewals = calculateUpcomingRenewals(products, 30)
  const productsNeedingReview = calculateProductsNeedingReview(products)
  const missingBeneficiaries = calculateMissingBeneficiaries(products)
  const missingDocuments = activeProducts.filter((product) =>
    ["MISSING", "REQUIRED", "PENDING"].includes(product.documentStatus ?? "")
  )

  return {
    totalInvestmentValue: calculateTotalInvestmentValue(products),
    totalInsuranceCoverage: calculateTotalInsuranceCoverage(products),
    totalAnnualPremium: calculateTotalAnnualPremium(products),
    totalMonthlyContribution: calculateTotalMonthlyContribution(products),
    totalEstimatedCommission: calculateTotalEstimatedCommission(products),
    activeProductsCount: activeProducts.length,
    productsNeedingReviewCount: productsNeedingReview.length,
    missingDocumentsCount: missingDocuments.length,
    upcomingRenewalsCount: upcomingRenewals.length,
    missingBeneficiariesCount: missingBeneficiaries.length,
  }
}

export function calculatePortfolioHealthScore(
  client: ClientLike,
  products: Product[],
  documents: DocumentLike[],
  tasks: TaskLike[]
) {
  let score = 0
  const actions: string[] = []

  const hasRequiredDocuments = documents.length > 0 && documents.every((document) => document.status !== "REQUIRED" && document.status !== "EXPIRED")
  if (hasRequiredDocuments && client.kycCompleted && client.identityVerified && client.consentGiven) score += 25
  else actions.push("Compléter les documents, le profil client et les consentements")

  if (client.riskProfile && client.riskProfile !== "UNKNOWN") score += 15
  else actions.push("Compléter le profil de risque")

  if (client.financialGoals || client.goals) score += 15
  else actions.push("Ajouter les objectifs financiers")

  const productsNeedingReview = calculateProductsNeedingReview(products)
  if (productsNeedingReview.length === 0) score += 15
  else actions.push("Réviser les produits en retard")

  const lastContactDays = client.lastContactAt
    ? Math.floor((Date.now() - new Date(client.lastContactAt).getTime()) / (1000 * 60 * 60 * 24))
    : null
  if (lastContactDays !== null && lastContactDays <= 90) score += 15
  else actions.push("Planifier un suivi client")

  const missingBeneficiaries = calculateMissingBeneficiaries(products)
  if (missingBeneficiaries.length === 0) score += 15
  else actions.push("Compléter les bénéficiaires manquants")

  const openCriticalTasks = tasks.filter((task) => task.status === "OVERDUE")
  if (openCriticalTasks.length > 0) actions.push("Traiter les tâches en retard")

  return {
    score: Math.min(score, 100),
    status:
      score >= 85 ? "Dossier solide" : score >= 65 ? "Dossier à améliorer" : "Dossier prioritaire",
    actions,
  }
}
