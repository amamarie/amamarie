export const subscriptionPlans = {
  ESSENTIEL: {
    label: "Essentiel",
    publicKey: "essentiel",
    description: "CRM de base pour gérer prospects, clients, tâches, calendrier et documents.",
    defaultSeatLimit: 1,
    modules: [
      "dashboard",
      "prospects",
      "pipeline",
      "clients",
      "tasks",
      "notifications",
      "calendar",
      "documents",
      "settings",
    ],
  },
  CROISSANCE: {
    label: "Croissance",
    publicKey: "croissance",
    legacyLabel: "Pro",
    description: "Automatisation commerciale pour relances, campagnes, IA, rendez-vous et suivi d’activité.",
    defaultSeatLimit: 2,
    modules: [
      "dashboard",
      "prospects",
      "pipeline",
      "clients",
      "tasks",
      "priorities",
      "smart-reminders",
      "notifications",
      "communications",
      "marketing",
      "telephony",
      "lead-forms",
      "calendar",
      "documents",
      "automations",
      "reports",
      "settings",
    ],
  },
  CABINET: {
    label: "Cabinet",
    publicKey: "cabinet",
    description: "Pilotage d’équipe avec rôles, automatisations avancées, conformité, recommandations et reporting.",
    defaultSeatLimit: 5,
    modules: [
      "dashboard",
      "prospects",
      "pipeline",
      "clients",
      "tasks",
      "priorities",
      "smart-reminders",
      "notifications",
      "communications",
      "marketing",
      "telephony",
      "lead-forms",
      "calendar",
      "documents",
      "compliance",
      "client-profile",
      "automations",
      "recommendations",
      "opportunities",
      "reports",
      "settings",
    ],
  },
  RESEAU: {
    label: "Ancien forfait",
    publicKey: "cabinet",
    description: "Ancien forfait conservé uniquement pour compatibilité des données existantes.",
    defaultSeatLimit: 10,
    modules: [
      "dashboard",
      "prospects",
      "pipeline",
      "clients",
      "tasks",
      "priorities",
      "smart-reminders",
      "notifications",
      "communications",
      "marketing",
      "telephony",
      "lead-forms",
      "calendar",
      "documents",
      "compliance",
      "client-profile",
      "automations",
      "recommendations",
      "opportunities",
      "reports",
      "settings",
    ],
  },
} as const

export const offerableSubscriptionPlanKeys = ["ESSENTIEL", "CROISSANCE", "CABINET"] as const

export const subscriptionStatuses = {
  ACTIVE: "Actif",
  TRIAL: "Essai",
  PAST_DUE: "Paiement requis",
  SUSPENDED: "Suspendu",
} as const

export const subscriptionPricingModes = {
  standard: "Offre standard",
  beta: "Offre bêta",
} as const

export const subscriptionCurrencies = {
  EUR: "Euro",
  CAD: "Dollar canadien",
} as const

export const organizationTypes = {
  INDEPENDANT: {
    label: "Indépendant",
    description: "Conseiller indépendant seul qui centralise clients, prospects et relances.",
  },
  CONSEILLER_ACTIF: {
    label: "Conseiller actif",
    description: "Conseiller avec assistant ou volume commercial plus élevé.",
  },
  CABINET: {
    label: "Cabinet",
    description: "Équipe de conseillers avec rôles, attribution et pilotage commercial.",
  },
  RESEAU: {
    label: "Organisation avancée archivée",
    description: "Ancien type conservé uniquement pour compatibilité des données existantes.",
  },
} as const

export const subscriptionPrices = {
  standard: {
    ESSENTIEL: {
      EUR: { monthly: "59 €", annual: "49 €" },
      CAD: { monthly: "89 $", annual: "75 $" },
    },
    CROISSANCE: {
      EUR: { monthly: "149 €", annual: "119 €" },
      CAD: { monthly: "219 $", annual: "179 $" },
    },
    CABINET: {
      EUR: { monthly: "399 €", annual: "329 €" },
      CAD: { monthly: "589 $", annual: "489 $" },
    },
    RESEAU: {
      EUR: { monthly: "399 €", annual: "329 €" },
      CAD: { monthly: "589 $", annual: "489 $" },
    },
  },
  beta: {
    ESSENTIEL: {
      EUR: { monthly: "29 €", annual: "29 €" },
      CAD: { monthly: "39 $", annual: "39 $" },
    },
    CROISSANCE: {
      EUR: { monthly: "79 €", annual: "79 €" },
      CAD: { monthly: "109 $", annual: "109 $" },
    },
    CABINET: {
      EUR: { monthly: "199 €", annual: "199 €" },
      CAD: { monthly: "279 $", annual: "279 $" },
    },
    RESEAU: {
      EUR: { monthly: "199 €", annual: "199 €" },
      CAD: { monthly: "279 $", annual: "279 $" },
    },
  },
} as const

export const subscriptionMonthlyRevenue = {
  standard: {
    ESSENTIEL: { EUR: 59, CAD: 89 },
    CROISSANCE: { EUR: 149, CAD: 219 },
    CABINET: { EUR: 399, CAD: 589 },
    RESEAU: { EUR: 399, CAD: 589 },
  },
  beta: {
    ESSENTIEL: { EUR: 29, CAD: 39 },
    CROISSANCE: { EUR: 79, CAD: 109 },
    CABINET: { EUR: 199, CAD: 279 },
    RESEAU: { EUR: 199, CAD: 279 },
  },
} as const

export const moduleCatalog = [
  { key: "dashboard", label: "Tableau de bord" },
  { key: "prospects", label: "Prospects" },
  { key: "pipeline", label: "Pipeline" },
  { key: "clients", label: "Clients" },
  { key: "tasks", label: "Tâches" },
  { key: "priorities", label: "Priorités" },
  { key: "smart-reminders", label: "Rappels intelligents" },
  { key: "notifications", label: "Notifications" },
  { key: "communications", label: "Communications" },
  { key: "marketing", label: "Marketing automatisé" },
  { key: "telephony", label: "Téléphonie" },
  { key: "lead-forms", label: "Formulaires" },
  { key: "calendar", label: "Calendrier" },
  { key: "documents", label: "Documents" },
  { key: "compliance", label: "Conformité" },
  { key: "client-profile", label: "Profil client" },
  { key: "automations", label: "Automatisations" },
  { key: "recommendations", label: "Recommandations" },
  { key: "opportunities", label: "Opportunités" },
  { key: "reports", label: "Rapports" },
  { key: "settings", label: "Paramètres" },
] as const

export type SubscriptionPlanKey = keyof typeof subscriptionPlans
export type SubscriptionStatusKey = keyof typeof subscriptionStatuses
export type SubscriptionPricingModeKey = keyof typeof subscriptionPricingModes
export type SubscriptionCurrencyKey = keyof typeof subscriptionCurrencies
export type OrganizationTypeKey = keyof typeof organizationTypes
export type ModuleKey = (typeof moduleCatalog)[number]["key"]
export type PlanMonthlyPriceOverrides = {
  [mode in SubscriptionPricingModeKey]?: {
    [plan in SubscriptionPlanKey]?: {
      [currency in SubscriptionCurrencyKey]?: number
    }
  }
}

export function normalizeSubscriptionPlan(value: unknown): SubscriptionPlanKey {
  const normalizedValue = String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  if (normalizedValue === "pro" || normalizedValue === "croissance") return "CROISSANCE"
  if (normalizedValue === "premium" || normalizedValue === "reseau") return "CABINET"
  if (normalizedValue === "cabinet") return "CABINET"
  if (normalizedValue === "essentiel" || normalizedValue === "starter") return "ESSENTIEL"
  return "ESSENTIEL"
}

export function normalizeSubscriptionStatus(value: unknown): SubscriptionStatusKey {
  return value === "TRIAL" || value === "PAST_DUE" || value === "SUSPENDED" || value === "ACTIVE" ? value : "ACTIVE"
}

export function normalizeSubscriptionPricingMode(value: unknown): SubscriptionPricingModeKey {
  const normalizedValue = String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  return normalizedValue === "beta" || normalizedValue === "offre beta" ? "beta" : "standard"
}

export function normalizeSubscriptionCurrency(value: unknown): SubscriptionCurrencyKey {
  const normalizedValue = String(value ?? "").trim().toLowerCase()
  return normalizedValue === "cad" || normalizedValue === "dollar canadien" ? "CAD" : "EUR"
}

export function normalizeOrganizationType(value: unknown): OrganizationTypeKey {
  if (value === "CONSEILLER_ACTIF" || value === "advisor" || value === "conseiller") return "CONSEILLER_ACTIF"
  if (value === "CABINET" || value === "cabinet" || value === "team") return "CABINET"
  if (value === "RESEAU" || value === "réseau" || value === "reseau" || value === "network") return "CABINET"
  return "INDEPENDANT"
}

export function organizationTypeForSubscriptionPlan(plan: unknown): OrganizationTypeKey {
  const normalizedPlan = normalizeSubscriptionPlan(plan)
  if (normalizedPlan === "CROISSANCE") return "CONSEILLER_ACTIF"
  if (normalizedPlan === "CABINET") return "CABINET"
  return "INDEPENDANT"
}

export function getSubscriptionPrice(plan: unknown, pricingMode: unknown, currency: unknown) {
  return subscriptionPrices[normalizeSubscriptionPricingMode(pricingMode)][normalizeSubscriptionPlan(plan)][normalizeSubscriptionCurrency(currency)]
}

export function formatSubscriptionMonthlyAmount(amount: number, currency: SubscriptionCurrencyKey) {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function getSubscriptionPriceSummary(plan: unknown, pricingMode: unknown, currency: unknown, overrides?: PlanMonthlyPriceOverrides) {
  const normalizedPlan = normalizeSubscriptionPlan(plan)
  const normalizedMode = normalizeSubscriptionPricingMode(pricingMode)
  const normalizedCurrency = normalizeSubscriptionCurrency(currency)
  const overriddenMonthlyAmount = overrides?.[normalizedMode]?.[normalizedPlan]?.[normalizedCurrency]
  const price = getSubscriptionPrice(plan, pricingMode, currency)
  const monthlyPrice = typeof overriddenMonthlyAmount === "number" && Number.isFinite(overriddenMonthlyAmount) && overriddenMonthlyAmount >= 0
    ? formatSubscriptionMonthlyAmount(overriddenMonthlyAmount, normalizedCurrency)
    : price.monthly

  if (normalizedMode === "beta") return `${monthlyPrice}/mois, prix bêta garanti 12 mois`

  return `${monthlyPrice}/mois ou ${price.annual}/mois en annuel`
}

export function encodeModuleAccess(modules: string[]) {
  const validKeys = new Set(moduleCatalog.map((module) => module.key))
  const uniqueModules = Array.from(new Set(modules.filter((module) => validKeys.has(module as ModuleKey))))

  return uniqueModules.length > 0 ? uniqueModules.join(",") : null
}

export function decodeModuleAccess(value?: string | null): ModuleKey[] | null {
  if (!value) return null

  const validKeys = new Set(moduleCatalog.map((module) => module.key))
  const modules = value
    .split(",")
    .map((module) => module.trim())
    .filter((module): module is ModuleKey => validKeys.has(module as ModuleKey))

  return modules.length > 0 ? modules : null
}

export function modulesForSubscription(plan: string, moduleAccess?: string | null): ModuleKey[] {
  const override = decodeModuleAccess(moduleAccess)
  if (override) return override

  return [...subscriptionPlans[normalizeSubscriptionPlan(plan)].modules]
}

export function canAccessModule({
  plan,
  status,
  moduleAccess,
  moduleKey,
}: {
  plan: string
  status: string
  moduleAccess?: string | null
  moduleKey: ModuleKey
}) {
  if (normalizeSubscriptionStatus(status) === "SUSPENDED") {
    return moduleKey === "dashboard" || moduleKey === "settings"
  }

  return modulesForSubscription(plan, moduleAccess).includes(moduleKey)
}
