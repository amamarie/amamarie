import { currentQuotaPeriod, getQuotaLimits, parseJsonStringArray } from "@/lib/developer-api/core"
import {
  normalizeOrganizationType,
  normalizeSubscriptionCurrency,
  normalizeSubscriptionPlan,
  normalizeSubscriptionPricingMode,
  normalizeSubscriptionStatus,
  organizationTypes,
  subscriptionPlans,
} from "@/lib/billing/plans"
import { countAdvisorSeats, getDeveloperConsoleData, getMonthlyRevenue } from "@/lib/developer-console"
import { getSubscriptionPlanPriceOverrides } from "@/lib/platform-settings"
import { prisma } from "@/lib/prisma"

const DAY = 24 * 60 * 60 * 1000

export function monthStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function currencyFromCents(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function daysSince(date?: Date | null) {
  if (!date) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / DAY))
}

function activeAdvisorUsers<T extends { role: string }>(users: T[]) {
  return users.filter((user) => user.role !== "DEVELOPER" && user.role !== "CLIENT")
}

export function computeHealthScore(input: {
  subscriptionStatus: string
  lastActivityAt?: Date | null
  usersCount: number
  activeUsersCount: number
  contactsCount: number
  tasksCount: number
  campaignsCount: number
  documentsCount: number
  openTicketsCount: number
  failedPaymentsCount: number
  integrationErrorsCount: number
}) {
  let score = 100
  const inactiveDays = daysSince(input.lastActivityAt)
  if (normalizeSubscriptionStatus(input.subscriptionStatus) === "SUSPENDED") score -= 35
  if (normalizeSubscriptionStatus(input.subscriptionStatus) === "PAST_DUE") score -= 25
  if (inactiveDays > 21) score -= 30
  else if (inactiveDays > 14) score -= 20
  else if (inactiveDays > 7) score -= 10
  if (input.usersCount > 0 && input.activeUsersCount === 0) score -= 20
  if (input.contactsCount < 10) score -= 15
  else if (input.contactsCount < 50) score -= 8
  if (input.tasksCount < 5) score -= 8
  if (input.campaignsCount === 0) score -= 6
  if (input.documentsCount === 0) score -= 4
  score -= Math.min(20, input.openTicketsCount * 5)
  score -= Math.min(25, input.failedPaymentsCount * 12)
  score -= Math.min(18, input.integrationErrorsCount * 6)

  return Math.max(0, Math.min(100, score))
}

export function computeChurnScore(input: {
  healthScore: number
  subscriptionStatus: string
  lastActivityAt?: Date | null
  openTicketsCount: number
  failedPaymentsCount: number
  contactsCount: number
  campaignsCount: number
  assistanceSessionsCount: number
}) {
  let score = 100 - input.healthScore
  const inactiveDays = daysSince(input.lastActivityAt)
  if (inactiveDays > 21) score += 25
  else if (inactiveDays > 14) score += 15
  if (normalizeSubscriptionStatus(input.subscriptionStatus) === "PAST_DUE") score += 25
  if (normalizeSubscriptionStatus(input.subscriptionStatus) === "SUSPENDED") score += 35
  score += Math.min(20, input.openTicketsCount * 5)
  score += Math.min(30, input.failedPaymentsCount * 15)
  if (input.contactsCount === 0) score += 20
  if (input.campaignsCount === 0) score += 8
  if (input.assistanceSessionsCount > 2) score += 8

  return Math.max(0, Math.min(100, Math.round(score)))
}

export function churnLabel(score: number) {
  if (score >= 70) return "Élevé"
  if (score >= 40) return "Moyen"
  return "Faible"
}

export async function getSuperAdminDashboardData() {
  const periodStart = monthStart()
  const developerData = await getDeveloperConsoleData({ auditLimit: 12 })
  const organizationIds = developerData.accountRecords.map((record) => record.organization.id)

  const [
    invoices,
    payments,
    tickets,
    notes,
    addOns,
    organizationAddOns,
    featureFlags,
    incidents,
    assistanceSessions,
    announcements,
    apiLogsThisMonth,
    appointmentsThisMonth,
    campaignsThisMonth,
  ] = await Promise.all([
    prisma.saasInvoice.findMany({ where: { organizationId: { in: organizationIds } }, orderBy: { createdAt: "desc" }, take: 30, include: { organization: { select: { id: true, name: true } } } }),
    prisma.saasPayment.findMany({ where: { organizationId: { in: organizationIds } }, orderBy: { createdAt: "desc" }, take: 30, include: { organization: { select: { id: true, name: true } } } }),
    prisma.superAdminTicket.findMany({ where: { organizationId: { in: organizationIds } }, orderBy: { createdAt: "desc" }, take: 30, include: { organization: { select: { id: true, name: true } }, assignedTo: { select: { name: true, email: true } } } }),
    prisma.superAdminNote.findMany({ where: { organizationId: { in: organizationIds } }, orderBy: { createdAt: "desc" }, take: 20, include: { organization: { select: { id: true, name: true } }, author: { select: { name: true, email: true } } } }),
    prisma.saasAddOn.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { organizations: true } } } }),
    prisma.organizationAddOn.findMany({ where: { status: "ACTIVE", organizationId: { in: organizationIds } }, include: { addOn: true, organization: { select: { id: true, name: true } } } }),
    prisma.featureFlag.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { overrides: true } } } }),
    prisma.platformIncident.findMany({ orderBy: { startedAt: "desc" }, take: 20, include: { impacts: { include: { organization: { select: { id: true, name: true } } } } } }),
    prisma.assistanceSession.findMany({ where: { organizationId: { in: organizationIds } }, orderBy: { createdAt: "desc" }, take: 20, include: { organization: { select: { id: true, name: true } }, adminUser: { select: { name: true, email: true } } } }),
    prisma.productAnnouncement.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { _count: { select: { deliveries: true } } } }),
    prisma.developerApiLog.count({ where: { organizationId: { in: organizationIds }, createdAt: { gte: periodStart } } }),
    prisma.developerAppointment.count({ where: { organizationId: { in: organizationIds }, createdAt: { gte: periodStart } } }),
    prisma.developerMarketingCampaign.count({ where: { organizationId: { in: organizationIds }, createdAt: { gte: periodStart } } }),
  ])

  const addOnMrrCents = organizationAddOns.reduce((total, item) => total + item.addOn.priceCents * item.quantity, 0)
  const baseMrrByCurrency = developerData.accountRecords.reduce(
    (totals, record) => {
      totals[record.currency] += record.monthlyRevenue
      return totals
    },
    { EUR: 0, CAD: 0 }
  )
  const mrrEstimateCents = baseMrrByCurrency.EUR * 100 + addOnMrrCents
  const activeAccounts = developerData.activeRecords.length
  const paidInvoicesCents = invoices.filter((invoice) => invoice.status === "PAID").reduce((total, invoice) => total + invoice.amountCents, 0)
  const failedPayments = payments.filter((payment) => payment.status === "FAILED")
  const openTickets = tickets.filter((ticket) => ticket.status !== "RESOLVED" && ticket.status !== "CLOSED")
  const criticalTickets = openTickets.filter((ticket) => ticket.priority === "CRITICAL" || ticket.priority === "HIGH")

  const accountHealth = developerData.accountRecords.map((record) => {
    const openTicketsCount = openTickets.filter((ticket) => ticket.organizationId === record.organization.id).length
    const failedPaymentsCount = failedPayments.filter((payment) => payment.organizationId === record.organization.id).length
    const integrationErrorsCount = developerData.developerIntegrations.filter((integration) => integration.organizationId === record.organization.id && integration.status === "ERROR").length
    const lastActivityAt = [
      record.organization.updatedAt,
      ...record.teamMembers.map((member) => member.internalCredential?.passwordUpdatedAt).filter(Boolean),
    ].filter(Boolean).sort((a, b) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0))[0]
    const healthScore = computeHealthScore({
      subscriptionStatus: record.status,
      lastActivityAt,
      usersCount: record.teamMembers.length,
      activeUsersCount: record.teamMembers.length,
      contactsCount: record.organization._count.clients + record.organization._count.leads,
      tasksCount: record.organization._count.tasks,
      campaignsCount: developerData.developerApiLogs.filter((log) => log.organizationId === record.organization.id && log.endpoint.includes("campaign")).length,
      documentsCount: record.organization._count.documents,
      openTicketsCount,
      failedPaymentsCount,
      integrationErrorsCount,
    })
    const churnScore = computeChurnScore({
      healthScore,
      subscriptionStatus: record.status,
      lastActivityAt,
      openTicketsCount,
      failedPaymentsCount,
      contactsCount: record.organization._count.clients + record.organization._count.leads,
      campaignsCount: developerData.developerApiLogs.filter((log) => log.organizationId === record.organization.id && log.endpoint.includes("campaign")).length,
      assistanceSessionsCount: assistanceSessions.filter((session) => session.organizationId === record.organization.id).length,
    })

    return { ...record, healthScore, churnScore, churnLabel: churnLabel(churnScore) }
  })

  return {
    ...developerData,
    accountHealth,
    finance: {
      mrrEstimateCents,
      arrEstimateCents: mrrEstimateCents * 12,
      arpuCents: activeAccounts > 0 ? Math.round(mrrEstimateCents / activeAccounts) : 0,
      paidInvoicesCents,
      failedPaymentsCount: failedPayments.length,
      invoices,
      payments,
    },
    productUsage: {
      contacts: developerData.totalContacts,
      tasks: developerData.accountRecords.reduce((total, record) => total + record.organization._count.tasks, 0),
      documents: developerData.accountRecords.reduce((total, record) => total + record.organization._count.documents, 0),
      apiCallsThisMonth: apiLogsThisMonth,
      appointmentsThisMonth,
      campaignsThisMonth,
    },
    support: {
      tickets,
      openTickets,
      criticalTickets,
      notes,
    },
    platform: {
      addOns,
      organizationAddOns,
      featureFlags,
      incidents,
      assistanceSessions,
      announcements,
    },
  }
}

export async function getSuperAdminAccount360(organizationId: string) {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY)
  const period = currentQuotaPeriod()
  const [
    planPriceOverrides,
    organization,
    apiKeys,
    webhooks,
    apiLogs,
    quota,
    integrations,
    webhookDeliveries,
    invoices,
    payments,
    tickets,
    notes,
    addOns,
    featureOverrides,
    assistanceSessions,
    incidents,
    announcementDeliveries,
    auditLogs,
    appointmentsCount,
    campaignsCount,
    campaignSubscribersCount,
    smsCount,
  ] = await Promise.all([
    getSubscriptionPlanPriceOverrides(),
    prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          orderBy: [{ role: "asc" }, { name: "asc" }],
          include: { internalCredential: { select: { passwordUpdatedAt: true } } },
        },
        gmailConnections: true,
        communicationSettings: true,
        _count: {
          select: {
            clients: true,
            leads: true,
            tasks: true,
            documents: true,
            notes: true,
            activities: true,
          },
        },
      },
    }),
    prisma.developerApiKey.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, include: { createdBy: { select: { name: true, email: true } } } }),
    prisma.developerWebhook.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    prisma.developerApiLog.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 100, include: { apiKey: { select: { name: true, keyPrefix: true } }, webhook: { select: { name: true } } } }),
    prisma.developerApiQuotaUsage.findUnique({ where: { organizationId_period: { organizationId, period } } }),
    prisma.developerIntegrationConnection.findMany({ where: { organizationId }, orderBy: { updatedAt: "desc" } }),
    prisma.developerWebhookDelivery.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 50, include: { webhook: { select: { name: true, url: true } } } }),
    prisma.saasInvoice.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
    prisma.saasPayment.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, include: { invoice: true } }),
    prisma.superAdminTicket.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, include: { assignedTo: { select: { name: true, email: true } }, createdBy: { select: { name: true, email: true } } } }),
    prisma.superAdminNote.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, include: { author: { select: { name: true, email: true } } } }),
    prisma.organizationAddOn.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, include: { addOn: true } }),
    prisma.featureFlagOverride.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, include: { featureFlag: true } }),
    prisma.assistanceSession.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, include: { adminUser: { select: { name: true, email: true } } } }),
    prisma.platformIncidentImpact.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, include: { incident: true } }),
    prisma.productAnnouncementDelivery.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, include: { announcement: true } }),
    prisma.auditLog.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true, email: true } } } }),
    prisma.developerAppointment.count({ where: { organizationId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.developerMarketingCampaign.count({ where: { organizationId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.developerCampaignSubscriber.count({ where: { organizationId, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.sMSMessage.count({ where: { organizationId, createdAt: { gte: thirtyDaysAgo } } }),
  ])

  if (!organization) return null

  const plan = normalizeSubscriptionPlan(organization.subscriptionPlan)
  const status = normalizeSubscriptionStatus(organization.subscriptionStatus)
  const pricingMode = normalizeSubscriptionPricingMode(organization.subscriptionPricingMode)
  const currency = normalizeSubscriptionCurrency(organization.subscriptionCurrency)
  const organizationType = normalizeOrganizationType(organization.organizationType)
  const teamMembers = activeAdvisorUsers(organization.users)
  const seatsUsed = countAdvisorSeats(teamMembers)
  const lastApiLog = apiLogs[0]?.createdAt
  const lastAuditLog = auditLogs[0]?.createdAt
  const lastActivityAt = [organization.updatedAt, lastApiLog, lastAuditLog].filter(Boolean).sort((a, b) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0))[0]
  const openTickets = tickets.filter((ticket) => ticket.status !== "RESOLVED" && ticket.status !== "CLOSED")
  const failedPayments = payments.filter((payment) => payment.status === "FAILED")
  const integrationErrors = integrations.filter((integration) => integration.status === "ERROR")
  const contactsCount = organization._count.clients + organization._count.leads
  const healthScore = computeHealthScore({
    subscriptionStatus: status,
    lastActivityAt,
    usersCount: teamMembers.length,
    activeUsersCount: teamMembers.length,
    contactsCount,
    tasksCount: organization._count.tasks,
    campaignsCount,
    documentsCount: organization._count.documents,
    openTicketsCount: openTickets.length,
    failedPaymentsCount: failedPayments.length,
    integrationErrorsCount: integrationErrors.length,
  })
  const churnScore = computeChurnScore({
    healthScore,
    subscriptionStatus: status,
    lastActivityAt,
    openTicketsCount: openTickets.length,
    failedPaymentsCount: failedPayments.length,
    contactsCount,
    campaignsCount,
    assistanceSessionsCount: assistanceSessions.filter((session) => session.status === "ACTIVE").length,
  })
  const limits = await getQuotaLimits(organizationId)
  const activeAddOnMrrCents = addOns.filter((item) => item.status === "ACTIVE").reduce((total, item) => total + item.addOn.priceCents * item.quantity, 0)
  const baseMrrCents = getMonthlyRevenue(plan, pricingMode, currency, planPriceOverrides) * 100

  return {
    organization,
    plan,
    planLabel: subscriptionPlans[plan].label,
    organizationType,
    organizationTypeLabel: organizationTypes[organizationType].label,
    status,
    pricingMode,
    currency,
    teamMembers,
    seatsUsed,
    contactsCount,
    healthScore,
    churnScore,
    churnLabel: churnLabel(churnScore),
    lastActivityAt,
    baseMrrCents,
    activeAddOnMrrCents,
    totalMrrCents: baseMrrCents + activeAddOnMrrCents,
    apiKeys: apiKeys.map((apiKey) => ({ ...apiKey, permissionsList: parseJsonStringArray(apiKey.permissions) })),
    webhooks: webhooks.map((webhook) => ({ ...webhook, eventList: parseJsonStringArray(webhook.events) })),
    apiLogs,
    quota: quota ?? { period, apiCalls: 0, webhookDeliveries: 0, emailApiCalls: 0 },
    quotaLimits: limits,
    integrations,
    webhookDeliveries,
    invoices,
    payments,
    tickets,
    openTickets,
    notes,
    addOns,
    featureOverrides,
    assistanceSessions,
    incidents,
    announcementDeliveries,
    auditLogs,
    usage30d: {
      appointmentsCount,
      campaignsCount,
      campaignSubscribersCount,
      smsCount,
      apiCalls: apiLogs.filter((log) => log.createdAt >= thirtyDaysAgo).length,
    },
  }
}
