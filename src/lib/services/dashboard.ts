import type { Prisma, UserRole } from "@prisma/client"

import { addDays, getEndOfMonth, getEndOfPreviousMonth, getEndOfToday, getStartOfMonth, getStartOfPreviousMonth, getStartOfToday } from "@/lib/date-ranges"
import { prisma } from "@/lib/prisma"
import { dashboardSummaryQuerySchema } from "@/lib/validations/dashboard"

const activeTaskStatuses = ["TODO", "IN_PROGRESS", "WAITING"] as const
const activeLeadStatuses = ["NEW", "TO_CONTACT", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"] as const

export type DashboardScope = "my" | "organization"

function normalizeScope(role: UserRole, requested?: DashboardScope): DashboardScope {
  if (role === "OWNER") return requested ?? "organization"
  return "my"
}

export function buildDashboardWhereClause({
  organizationId,
  userId,
  role,
  advisorId,
  scope,
}: {
  organizationId: string
  userId: string
  role: UserRole
  advisorId?: string
  scope?: DashboardScope
}) {
  const normalizedScope = normalizeScope(role, scope)
  const targetAdvisorId = advisorId ?? userId
  const organization = { organizationId }

  if (normalizedScope === "organization") {
    return {
      scope: normalizedScope,
      lead: organization satisfies Prisma.LeadWhereInput,
      client: organization satisfies Prisma.ClientWhereInput,
      task: organization satisfies Prisma.TaskWhereInput,
      document: organization satisfies Prisma.DocumentWhereInput,
      product: organization satisfies Prisma.FinancialProductWhereInput,
      insuranceAnalysis: organization satisfies Prisma.InsuranceNeedsAnalysisWhereInput,
      alert: organization satisfies Prisma.ComplianceAlertWhereInput,
      notification: organization satisfies Prisma.NotificationWhereInput,
      activity: organization satisfies Prisma.ActivityWhereInput,
      priority: organization satisfies Prisma.PriorityItemWhereInput,
    }
  }

  return {
    scope: normalizedScope,
    lead: { organizationId, advisorId: targetAdvisorId } satisfies Prisma.LeadWhereInput,
    client: { organizationId, advisorId: targetAdvisorId } satisfies Prisma.ClientWhereInput,
    task: {
      organizationId,
      OR: [
        { assignedToId: targetAdvisorId },
        { createdById: targetAdvisorId },
        { client: { advisorId: targetAdvisorId } },
        { lead: { advisorId: targetAdvisorId } },
      ],
    } satisfies Prisma.TaskWhereInput,
    document: {
      organizationId,
      OR: [
        { uploadedById: targetAdvisorId },
        { client: { advisorId: targetAdvisorId } },
        { lead: { advisorId: targetAdvisorId } },
      ],
    } satisfies Prisma.DocumentWhereInput,
    product: {
      organizationId,
      OR: [{ advisorId: targetAdvisorId }, { client: { advisorId: targetAdvisorId } }],
    } satisfies Prisma.FinancialProductWhereInput,
    insuranceAnalysis: {
      organizationId,
      OR: [{ advisorId: targetAdvisorId }, { client: { advisorId: targetAdvisorId } }],
    } satisfies Prisma.InsuranceNeedsAnalysisWhereInput,
    alert: {
      organizationId,
      client: { advisorId: targetAdvisorId },
    } satisfies Prisma.ComplianceAlertWhereInput,
    notification: {
      organizationId,
      OR: [{ userId: targetAdvisorId }, { userId: null }],
    } satisfies Prisma.NotificationWhereInput,
    activity: {
      organizationId,
      OR: [
        { userId: targetAdvisorId },
        { client: { advisorId: targetAdvisorId } },
        { lead: { advisorId: targetAdvisorId } },
      ],
    } satisfies Prisma.ActivityWhereInput,
    priority: {
      organizationId,
      OR: [{ advisorId: targetAdvisorId }, { client: { advisorId: targetAdvisorId } }, { lead: { advisorId: targetAdvisorId } }],
    } satisfies Prisma.PriorityItemWhereInput,
  }
}

export async function getDashboardSummary({
  organizationId,
  userId,
  role,
  advisorId,
  scope,
  dateFrom,
  dateTo,
}: {
  organizationId: string
  userId: string
  role: UserRole
  advisorId?: string
  scope?: DashboardScope
  dateFrom?: Date
  dateTo?: Date
}) {
  const parsed = dashboardSummaryQuerySchema.parse({ advisorId, scope, dateFrom, dateTo })
  const normalizedScope = normalizeScope(role, parsed.scope)

  if (parsed.advisorId) {
    await prisma.user.findFirstOrThrow({ where: { id: parsed.advisorId, organizationId }, select: { id: true } })
  }

  const now = new Date()
  const startOfToday = getStartOfToday(now)
  const endOfToday = getEndOfToday(now)
  const startOfMonth = parsed.dateFrom ?? getStartOfMonth(now)
  const endOfMonth = parsed.dateTo ?? getEndOfMonth(now)
  const startOfPreviousMonth = getStartOfPreviousMonth(now)
  const endOfPreviousMonth = getEndOfPreviousMonth(now)
  const next30Days = addDays(now, 30)
  const next7Days = addDays(now, 7)

  const where = buildDashboardWhereClause({
    organizationId,
    userId,
    role,
    advisorId: parsed.advisorId,
    scope: normalizedScope,
  })

  const [
    newLeadsThisMonth,
    newLeadsPreviousMonth,
    tasksToday,
    todayTasks,
    overdueTasks,
    overdueTasksList,
    activeClients,
    unreadNotifications,
    requiredDocuments,
    requiredDocumentsList,
    upcomingRenewals,
    upcomingRenewalsList,
    productsToReview,
    criticalAlerts,
    importantAlerts,
    leadPipelineRaw,
    recentActivities,
    priorities,
    hotLeads,
    complianceScores,
    commissionAggregate,
    needsAnalysesToReview,
    needsAnalysesList,
  ] = await Promise.all([
    prisma.lead.count({ where: { ...where.lead, createdAt: { gte: startOfMonth, lte: endOfMonth } } }),
    prisma.lead.count({ where: { ...where.lead, createdAt: { gte: startOfPreviousMonth, lte: endOfPreviousMonth } } }),
    prisma.task.count({ where: { ...where.task, dueDate: { gte: startOfToday, lte: endOfToday }, status: { in: [...activeTaskStatuses] } } }),
    prisma.task.findMany({
      where: { ...where.task, dueDate: { gte: startOfToday, lte: endOfToday }, status: { in: [...activeTaskStatuses] } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 8,
      select: { id: true, title: true, priority: true, status: true, dueDate: true, client: { select: { id: true, firstName: true, lastName: true } }, lead: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.task.count({ where: { ...where.task, dueDate: { lt: now }, status: { in: [...activeTaskStatuses] } } }),
    prisma.task.findMany({
      where: { ...where.task, dueDate: { lt: now }, status: { in: [...activeTaskStatuses] } },
      orderBy: [{ dueDate: "asc" }],
      take: 6,
      select: { id: true, title: true, priority: true, status: true, dueDate: true, client: { select: { id: true, firstName: true, lastName: true } }, lead: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.client.count({ where: { ...where.client, status: { not: "ARCHIVED" } } }),
    prisma.notification.count({ where: { ...where.notification, status: "UNREAD", isRead: false } }),
    prisma.document.count({ where: { ...where.document, status: { in: ["REQUIRED", "REQUESTED", "EXPIRED"] } } }),
    prisma.document.findMany({
      where: { ...where.document, status: { in: ["REQUIRED", "REQUESTED", "EXPIRED"] } },
      orderBy: [{ status: "asc" }, { requiredBy: "asc" }, { createdAt: "desc" }],
      take: 6,
      select: { id: true, name: true, type: true, status: true, requiredBy: true, expiresAt: true, client: { select: { id: true, firstName: true, lastName: true } }, lead: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.financialProduct.count({ where: { ...where.product, status: "ACTIVE", renewalAt: { gte: now, lte: next30Days } } }),
    prisma.financialProduct.findMany({
      where: { ...where.product, status: "ACTIVE", renewalAt: { gte: now, lte: next30Days } },
      orderBy: { renewalAt: "asc" },
      take: 6,
      select: { id: true, productName: true, company: true, type: true, renewalAt: true, client: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.financialProduct.findMany({
      where: { ...where.product, status: { in: ["ACTIVE", "UNDER_REVIEW"] }, OR: [{ nextReviewAt: { lte: next30Days } }, { nextReviewAt: null, lastReviewAt: { lte: addDays(now, -365) } }] },
      orderBy: [{ nextReviewAt: "asc" }, { updatedAt: "asc" }],
      take: 6,
      select: { id: true, productName: true, company: true, type: true, nextReviewAt: true, lastReviewAt: true, client: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.complianceAlert.count({ where: { ...where.alert, status: "OPEN", severity: { in: ["CRITICAL", "HIGH"] } } }),
    prisma.complianceAlert.findMany({
      where: { ...where.alert, status: "OPEN", severity: { in: ["CRITICAL", "HIGH"] } },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take: 6,
      select: { id: true, title: true, description: true, severity: true, type: true, actionUrl: true, createdAt: true, client: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.lead.groupBy({ by: ["status"], where: { ...where.lead, status: { in: [...activeLeadStatuses] } }, _count: { _all: true } }),
    prisma.activity.findMany({
      where: where.activity,
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { user: { select: { id: true, name: true, email: true } }, client: { select: { id: true, firstName: true, lastName: true } }, lead: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.priorityItem.findMany({
      where: { ...where.priority, status: "ACTIVE", OR: [{ level: { in: ["CRITICAL", "HIGH"] } }, { dueAt: { lte: next7Days } }] },
      orderBy: [{ score: "desc" }, { dueAt: "asc" }],
      take: 5,
      select: { id: true, level: true, score: true, title: true, reason: true, suggestedAction: true, actionUrl: true, dueAt: true, entityType: true },
    }),
    prisma.lead.findMany({
      where: { ...where.lead, status: { in: [...activeLeadStatuses] }, OR: [{ priority: { in: ["HIGH", "URGENT"] } }, { source: "INBOUND_CALL" }, { status: "PROPOSAL_SENT" }] },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      take: 6,
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, status: true, source: true, priority: true, nextAction: true, lastContactAt: true, createdAt: true, estimatedValue: true },
    }),
    prisma.clientKycProfile.findMany({ where: { organizationId, client: normalizedScope === "my" ? { advisorId: parsed.advisorId ?? userId } : undefined }, select: { complianceScore: true } }),
    prisma.financialProduct.aggregate({ where: where.product, _sum: { commissionAmount: true } }),
    prisma.insuranceNeedsAnalysis.count({
      where: { ...where.insuranceAnalysis, status: { in: ["DRAFT", "MISSING_DATA", "IN_ANALYSIS", "ADVISOR_REVIEW", "RECOMMENDATION_PREPARED", "NEEDS_UPDATE"] } },
    }),
    prisma.insuranceNeedsAnalysis.findMany({
      where: { ...where.insuranceAnalysis, status: { in: ["DRAFT", "MISSING_DATA", "IN_ANALYSIS", "ADVISOR_REVIEW", "RECOMMENDATION_PREPARED", "NEEDS_UPDATE"] } },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 6,
      select: {
        id: true,
        analysisType: true,
        status: true,
        summary: true,
        reportDocumentId: true,
        updatedAt: true,
        client: { select: { id: true, firstName: true, lastName: true } },
        results: { select: { gapAmount: true }, take: 1 },
      },
    }),
  ])

  const pipelineMap = new Map(leadPipelineRaw.map((item) => [item.status, item._count._all]))
  const leadPipeline = activeLeadStatuses.map((status) => ({ status, count: pipelineMap.get(status) ?? 0 }))
  const averageComplianceScore = complianceScores.length > 0 ? Math.round(complianceScores.reduce((sum, item) => sum + item.complianceScore, 0) / complianceScores.length) : null

  return {
    scope: normalizedScope,
    dateRange: { dateFrom: startOfMonth, dateTo: endOfMonth },
    kpis: {
      newLeadsThisMonth,
      newLeadsPreviousMonth,
      tasksToday,
      overdueTasks,
      activeClients,
      unreadNotifications,
      requiredDocuments,
      upcomingRenewals,
      criticalAlerts,
      productsToReview: productsToReview.length,
      averageComplianceScore,
      estimatedCommissions: commissionAggregate._sum.commissionAmount ?? 0,
      needsAnalysesToReview,
    },
    leadPipeline,
    recentActivities,
    todayTasks,
    overdueTasksList,
    importantAlerts,
    upcomingRenewalsList,
    requiredDocumentsList,
    hotLeads,
    priorities,
    productsToReview,
    needsAnalysesList,
    generatedAt: new Date(),
  }
}
