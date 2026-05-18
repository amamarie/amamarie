import { getWorkflowRuntimeStatus } from "@/lib/automation/workflows"
import {
  decodeModuleAccess,
  modulesForSubscription,
  normalizeOrganizationType,
  normalizeSubscriptionCurrency,
  normalizeSubscriptionPlan,
  normalizeSubscriptionPricingMode,
  normalizeSubscriptionStatus,
  subscriptionMonthlyRevenue,
  type PlanMonthlyPriceOverrides,
} from "@/lib/billing/plans"
import { currentQuotaPeriod, getQuotaLimits, parseJsonStringArray } from "@/lib/developer-api/core"
import { getSubscriptionPlanPriceOverrides } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"

export const TEMPORARY_ADVISOR_PASSWORD = "FinAssuro2026"

export const apiKeys = [
  { name: "Site web cabinet", environment: "Production", permissions: "Contacts, RDV", lastUsed: "il y a 2 h", createdAt: "03/05/2026", status: "Active", tone: "emerald" as const },
  { name: "Make automatisation", environment: "Production", permissions: "Contacts, webhooks", lastUsed: "hier", createdAt: "28/04/2026", status: "Active", tone: "emerald" as const },
  { name: "Test intégrateur", environment: "Sandbox", permissions: "Toutes test", lastUsed: "jamais", createdAt: "10/05/2026", status: "Active", tone: "violet" as const },
  { name: "Ancienne clé Zapier", environment: "Production", permissions: "Contacts", lastUsed: "12/03/2026", createdAt: "01/01/2026", status: "Révoquée", tone: "slate" as const },
]

export const webhookRows = [
  { name: "Make - nouveaux prospects", url: "https://hook.make.com/...", events: "contact.created", status: "Actif", lastDelivery: "il y a 5 min", success: "98 %" },
  { name: "Back-office cabinet", url: "https://api.cabinet.fr/hook", events: "deal.stage_changed", status: "Actif", lastDelivery: "hier", success: "100 %" },
  { name: "Test sandbox", url: "https://webhook.site/...", events: "Tous", status: "Test", lastDelivery: "jamais", success: "—" },
]

export const apiLogRows = [
  { time: "14:42", type: "API", method: "POST", endpoint: "/v1/contacts", status: "201 Created", latency: "240 ms", ip: "185.42.XX.XX", tone: "emerald" as const },
  { time: "14:40", type: "Webhook", method: "POST", endpoint: "contact.created", status: "200 OK", latency: "184 ms", ip: "—", tone: "emerald" as const },
  { time: "14:38", type: "API", method: "GET", endpoint: "/v1/deals", status: "401 Unauthorized", latency: "42 ms", ip: "92.10.XX.XX", tone: "rose" as const },
  { time: "14:31", type: "API", method: "POST", endpoint: "/v1/tasks", status: "400 Bad Request", latency: "88 ms", ip: "185.42.XX.XX", tone: "amber" as const },
]

export const endpointCards = [
  { method: "POST", path: "/v1/contacts", permission: "contacts:create", description: "Créer un prospect depuis un formulaire site web." },
  { method: "POST", path: "/v1/deals", permission: "deals:create", description: "Créer une opportunité commerciale liée à un contact." },
  { method: "POST", path: "/v1/tasks", permission: "tasks:create", description: "Créer une tâche de relance assignée à un conseiller." },
  { method: "POST", path: "/v1/appointments", permission: "appointments:create", description: "Créer un rendez-vous ou une demande de bilan." },
  { method: "POST", path: "/v1/campaigns", permission: "campaigns:create", description: "Créer une campagne marketing prête à recevoir des abonnés." },
  { method: "POST", path: "/v1/campaigns/{id}/subscribers", permission: "campaigns:subscribe", description: "Ajouter un contact consentant à une campagne." },
  { method: "POST", path: "/v1/documents", permission: "documents:request", description: "Demander un document sécurisé à un client." },
  { method: "POST", path: "/v1/webhooks", permission: "webhooks:create", description: "Enregistrer une destination d’événements CRM." },
  { method: "POST", path: "/oauth/token", permission: "OAuth 2.0", description: "Obtenir un jeton client_credentials pour un portail partenaire." },
]

export const quotaRows = [
  { resource: "Appels API / mois", usage: "8 240", limit: "50 000", status: "OK", tone: "emerald" as const },
  { resource: "Appels API / minute", usage: "42", limit: "300", status: "OK", tone: "emerald" as const },
  { resource: "Webhooks / mois", usage: "3 120", limit: "20 000", status: "OK", tone: "emerald" as const },
  { resource: "Emails API / mois", usage: "4 900", limit: "5 000", status: "Proche limite", tone: "amber" as const },
]

export const integrationCards = [
  { name: "Google Calendar", category: "Calendrier", status: "Connecté", detail: "Dernière synchronisation : il y a 8 min" },
  { name: "Gmail", category: "Email", status: "Connecté", detail: "Historique courriel et envoi contrôlé" },
  { name: "Brevo", category: "Marketing", status: "Disponible", detail: "Campagnes email et listes marketing" },
  { name: "Make / Zapier", category: "Automatisation", status: "Recommandé", detail: "Flux no-code avec webhooks" },
  { name: "Yousign / DocuSign", category: "Signature", status: "Bientôt", detail: "Signature électronique sécurisée" },
  { name: "n8n", category: "Automatisation avancée", status: "Technique", detail: "Workflows serveurs supervisés" },
]

export const monthlyRevenueByPlan = subscriptionMonthlyRevenue

export function countAdvisorSeats(users: Array<{ role: string }>) {
  return users.filter((user) => user.role === "OWNER" || user.role === "ADVISOR" || user.role === "ASSISTANT" || user.role === "COMPLIANCE").length
}

export function getMonthlyRevenue(plan: unknown, pricingMode: unknown, currency: unknown, overrides?: PlanMonthlyPriceOverrides) {
  const normalizedPlan = normalizeSubscriptionPlan(plan)
  const normalizedMode = normalizeSubscriptionPricingMode(pricingMode)
  const normalizedCurrency = normalizeSubscriptionCurrency(currency)
  const overriddenAmount = overrides?.[normalizedMode]?.[normalizedPlan]?.[normalizedCurrency]

  if (typeof overriddenAmount === "number" && Number.isFinite(overriddenAmount) && overriddenAmount >= 0) {
    return overriddenAmount
  }

  return monthlyRevenueByPlan[normalizedMode][normalizedPlan][normalizedCurrency]
}

export function formatCurrencyAmount(value: number, currency: "EUR" | "CAD") {
  if (value <= 0) return currency === "EUR" ? "0 €" : "0 $"

  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("fr-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date)
}

export function formatAuditAction(action: string) {
  const labels: Record<string, string> = {
    SAAS_ACCESS_UPDATED: "Accès cabinet mis à jour",
    USER_PASSWORD_RESET: "Mot de passe réinitialisé",
  }

  return labels[action] ?? action.replaceAll("_", " ").toLowerCase()
}

function getAccountHealthScore({
  status,
  seatLimitExceeded,
  missingPasswordCount,
  customModules,
  workflowConfigured,
}: {
  status: string
  seatLimitExceeded: boolean
  missingPasswordCount: number
  customModules: boolean
  workflowConfigured: boolean
}) {
  let score = 100
  if (status === "SUSPENDED") score -= 35
  if (status === "PAST_DUE") score -= 20
  if (seatLimitExceeded) score -= 20
  if (missingPasswordCount > 0) score -= Math.min(25, missingPasswordCount * 8)
  if (customModules) score -= 5
  if (!workflowConfigured) score -= 8

  return Math.max(0, score)
}

export function getAverageHealth(records: Array<{ healthScore: number }>) {
  if (records.length === 0) return 0

  return Math.round(records.reduce((total, record) => total + record.healthScore, 0) / records.length)
}

export async function getDeveloperConsoleData({ auditLimit = 6 }: { auditLimit?: number } = {}) {
  const workflowRuntime = getWorkflowRuntimeStatus()
  const [planPriceOverrides, organizations, recentAuditLogs, developerApiKeys, developerWebhooks, developerApiLogs, developerOAuthClients, developerIntegrations, developerWebhookDeliveries, developerPartnerRequests] = await Promise.all([
    getSubscriptionPlanPriceOverrides(),
    prisma.organization.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            title: true,
            internalCredential: { select: { passwordUpdatedAt: true } },
          },
          orderBy: [{ role: "asc" }, { name: "asc" }],
        },
        _count: {
          select: {
            clients: true,
            leads: true,
            documents: true,
            tasks: true,
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      take: auditLimit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
        organization: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.developerApiKey.findMany({
      take: 25,
      orderBy: { createdAt: "desc" },
      include: {
        organization: { select: { id: true, name: true, subscriptionPlan: true } },
        createdBy: { select: { name: true, email: true } },
      },
    }),
    prisma.developerWebhook.findMany({
      take: 25,
      orderBy: { createdAt: "desc" },
      include: {
        organization: { select: { id: true, name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    }),
    prisma.developerApiLog.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        organization: { select: { id: true, name: true, subscriptionPlan: true } },
        apiKey: { select: { name: true, keyPrefix: true } },
        webhook: { select: { name: true } },
      },
    }),
    prisma.developerOAuthClient.findMany({
      take: 25,
      orderBy: { createdAt: "desc" },
      include: {
        organization: { select: { id: true, name: true, subscriptionPlan: true } },
      },
    }),
    prisma.developerIntegrationConnection.findMany({
      take: 50,
      orderBy: { updatedAt: "desc" },
      include: {
        organization: { select: { id: true, name: true } },
      },
    }),
    prisma.developerWebhookDelivery.findMany({
      take: 25,
      orderBy: { createdAt: "desc" },
      include: {
        webhook: { select: { name: true, url: true } },
        organization: { select: { id: true, name: true } },
      },
    }),
    prisma.developerPartnerRequest.findMany({
      take: 25,
      orderBy: { createdAt: "desc" },
    }),
  ])

  const advisorOrganizations = organizations.filter((organization) => organization.users.some((member) => member.role !== "DEVELOPER" && member.role !== "CLIENT"))
  const accountRecords = advisorOrganizations.map((organization) => {
    const plan = normalizeSubscriptionPlan(organization.subscriptionPlan)
    const organizationType = normalizeOrganizationType(organization.organizationType)
    const status = normalizeSubscriptionStatus(organization.subscriptionStatus)
    const pricingMode = normalizeSubscriptionPricingMode(organization.subscriptionPricingMode)
    const currency = normalizeSubscriptionCurrency(organization.subscriptionCurrency)
    const teamMembers = organization.users.filter((member) => member.role !== "DEVELOPER" && member.role !== "CLIENT")
    const seatsUsed = countAdvisorSeats(teamMembers)
    const seatLimitExceeded = seatsUsed > organization.advisorSeatLimit
    const missingPasswordCount = teamMembers.filter((member) => !member.internalCredential).length
    const includedModules = modulesForSubscription(organization.subscriptionPlan, organization.moduleAccess)
    const customModules = Boolean(decodeModuleAccess(organization.moduleAccess))
    const healthScore = getAccountHealthScore({
      status,
      seatLimitExceeded,
      missingPasswordCount,
      customModules,
      workflowConfigured: workflowRuntime.configured,
    })

    return {
      organization,
      plan,
      organizationType,
      status,
      pricingMode,
      currency,
      teamMembers,
      seatsUsed,
      seatLimitExceeded,
      missingPasswordCount,
      includedModules,
      customModules,
      healthScore,
      monthlyRevenue: getMonthlyRevenue(plan, pricingMode, currency, planPriceOverrides),
    }
  })

  const activeRecords = accountRecords.filter((record) => record.status !== "SUSPENDED")
  const suspendedRecords = accountRecords.filter((record) => record.status === "SUSPENDED")
  const atRiskRecords = accountRecords.filter((record) => record.seatLimitExceeded || record.missingPasswordCount > 0 || record.status === "SUSPENDED")
  const customAccessRecords = accountRecords.filter((record) => record.customModules)
  const totalSeatsUsed = accountRecords.reduce((total, record) => total + record.seatsUsed, 0)
  const totalSeatLimit = accountRecords.reduce((total, record) => total + record.organization.advisorSeatLimit, 0)
  const totalContacts = accountRecords.reduce((total, record) => total + record.organization._count.clients + record.organization._count.leads, 0)
  const revenueByCurrency = accountRecords.reduce(
    (totals, record) => {
      totals[record.currency] += record.monthlyRevenue
      return totals
    },
    { EUR: 0, CAD: 0 }
  )
  const quotaRowsByOrganization = await Promise.all(
    accountRecords.map(async (record) => {
      const [limits, usage] = await Promise.all([
        getQuotaLimits(record.organization.id),
        prisma.developerApiQuotaUsage.findUnique({
          where: { organizationId_period: { organizationId: record.organization.id, period: currentQuotaPeriod() } },
        }),
      ])

      return {
        organizationId: record.organization.id,
        organizationName: record.organization.name,
        limits,
        usage: usage ?? {
          apiCalls: 0,
          webhookDeliveries: 0,
          emailApiCalls: 0,
          period: currentQuotaPeriod(),
        },
      }
    })
  )

  return {
    accountRecords,
    planPriceOverrides,
    activeRecords,
    suspendedRecords,
    atRiskRecords,
    customAccessRecords,
    totalSeatsUsed,
    totalSeatLimit,
    totalContacts,
    revenueByCurrency,
    recentAuditLogs,
    workflowRuntime,
    developerApiKeys: developerApiKeys.map((apiKey) => ({
      ...apiKey,
      permissionsList: parseJsonStringArray(apiKey.permissions),
    })),
    developerWebhooks: developerWebhooks.map((webhook) => ({
      ...webhook,
      eventList: parseJsonStringArray(webhook.events),
    })),
    developerApiLogs,
    developerOAuthClients: developerOAuthClients.map((client) => ({
      ...client,
      permissionsList: parseJsonStringArray(client.permissions),
      redirectUriList: parseJsonStringArray(client.redirectUris),
    })),
    developerIntegrations,
    developerWebhookDeliveries,
    developerPartnerRequests,
    quotaRowsByOrganization,
  }
}
