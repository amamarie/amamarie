import { handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import { priorityQuerySchema } from "@/lib/validations/priority"
import type { Prisma } from "@prisma/client"

export async function GET(request: Request) {
  try {
    const { organizationId } = await getTenantContext()
    const params = Object.fromEntries(new URL(request.url).searchParams.entries())
    const query = priorityQuerySchema.parse(params)
    const skip = (query.page - 1) * query.limit

    const where: Prisma.PriorityItemWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : { status: { in: ["ACTIVE", "SNOOZED"] } }),
      ...(query.level ? { level: query.level } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.advisorId ? { advisorId: query.advisorId } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
    }

    const [items, total] = await Promise.all([
      prisma.priorityItem.findMany({
        where,
        orderBy: [{ score: "desc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        skip,
        take: query.limit,
        include: {
          advisor: { select: { id: true, name: true } },
          client: { select: { id: true, firstName: true, lastName: true } },
          lead: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.priorityItem.count({ where }),
    ])

    return ok({ items, total, page: query.page, limit: query.limit })
  } catch (error) {
    return handleApiError(error)
  }
}
