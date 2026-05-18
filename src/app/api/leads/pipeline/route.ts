import type { Prisma } from "@prisma/client"

import { handleApiError, ok } from "@/lib/api-response"
import { leadStatusLabels } from "@/lib/lead-status"
import { archivePipelineStatuses, pipelineStatuses, pipelineStatusDescriptions } from "@/lib/pipeline"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import { pipelineQuerySchema } from "@/lib/validations/pipeline"

function queryObject(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries())
}

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const query = pipelineQuerySchema.parse(queryObject(request))
    const statuses = [
      ...pipelineStatuses,
      ...(query.includeLost ? (["LOST"] as const) : []),
      ...(query.includeArchived ? (["ARCHIVED", "CONVERTED"] as const) : []),
    ]

    const where: Prisma.LeadWhereInput = {
      organizationId,
      status: { in: statuses },
      ...(query.advisorId ? { advisorId: query.advisorId } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              gte: query.dateFrom,
              lte: query.dateTo,
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: "insensitive" } },
              { lastName: { contains: query.search, mode: "insensitive" } },
              { phone: { contains: query.search, mode: "insensitive" } },
              { email: { contains: query.search, mode: "insensitive" } },
              { interestType: { contains: query.search, mode: "insensitive" } },
              { nextAction: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    }

    const leads = await prisma.lead.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        status: true,
        previousStatus: true,
        source: true,
        priority: true,
        interestType: true,
        nextAction: true,
        lastContactAt: true,
        createdAt: true,
        estimatedValue: true,
        lostReason: true,
        lostAt: true,
        convertedAt: true,
        archivedAt: true,
        advisor: { select: { id: true, name: true } },
        tasks: {
          where: { status: { in: ["TODO", "IN_PROGRESS", "WAITING", "OVERDUE", "SNOOZED"] } },
          select: { id: true, title: true, priority: true, dueDate: true, status: true },
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          take: 3,
        },
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: statuses.length * 50,
    })

    const columns = statuses.map((status) => {
      const items = leads.filter((lead) => lead.status === status).slice(0, 50)
      const urgentCount = items.filter((lead) => lead.priority === "URGENT" || lead.priority === "HIGH").length
      const potentialTotal = items.reduce((total, lead) => total + (lead.estimatedValue ?? 0), 0)

      return {
        status,
        title: leadStatusLabels[status],
        description: pipelineStatusDescriptions[status],
        count: items.length,
        urgentCount,
        potentialTotal,
        leads: items,
      }
    })

    const activeLeads = leads.filter((lead) => pipelineStatuses.includes(lead.status))
    const summary = {
      totalActive: activeLeads.length,
      urgentCount: activeLeads.filter((lead) => lead.priority === "URGENT" || lead.priority === "HIGH").length,
      proposalsSent: activeLeads.filter((lead) => lead.status === "PROPOSAL_SENT").length,
      wonCount: activeLeads.filter((lead) => lead.status === "WON").length,
      potentialTotal: activeLeads.reduce((total, lead) => total + (lead.estimatedValue ?? 0), 0),
      archivedCount: leads.filter((lead) => archivePipelineStatuses.includes(lead.status)).length,
    }

    return ok({ columns, summary })
  } catch (error) {
    return handleApiError(error)
  }
}
