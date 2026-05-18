import { fail, handleApiError, ok } from "@/lib/api-response"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const client = await prisma.client.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    const [events, complaints, incidents, supervisionReviews, exceptions, checklistResults, auditReports, activeChecklists] = await Promise.all([
      prisma.complianceEvent.findMany({
        where: { organizationId, clientId: id },
        include: { assignedTo: { select: { id: true, name: true, role: true } }, createdBy: { select: { id: true, name: true, role: true } }, resolvedBy: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.complaint.findMany({
        where: { organizationId, clientId: id },
        include: { advisor: { select: { id: true, name: true, role: true } }, assignedTo: { select: { id: true, name: true, role: true } } },
        orderBy: { receivedAt: "desc" },
        take: 50,
      }),
      prisma.complianceIncident.findMany({
        where: { organizationId, OR: [{ clientId: id }, { affectedClientIds: { array_contains: id } }] },
        include: { detectedBy: { select: { id: true, name: true, role: true } }, assignedTo: { select: { id: true, name: true, role: true } } },
        orderBy: { detectedAt: "desc" },
        take: 50,
      }),
      prisma.supervisionReview.findMany({
        where: { organizationId, clientId: id },
        include: { advisor: { select: { id: true, name: true, role: true } }, reviewer: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.complianceException.findMany({
        where: { organizationId, clientId: id },
        include: { advisor: { select: { id: true, name: true, role: true } }, requestedBy: { select: { id: true, name: true, role: true } }, approvedBy: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.clientChecklistResult.findMany({
        where: { organizationId, clientId: id },
        include: { checklist: true, item: true, completedBy: { select: { id: true, name: true, role: true } } },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.auditReport.findMany({
        where: { organizationId, clientId: id },
        include: { createdBy: { select: { id: true, name: true, role: true } } },
        orderBy: { generatedAt: "desc" },
        take: 25,
      }),
      prisma.productChecklist.findMany({
        where: { organizationId, active: true },
        include: { items: { orderBy: { orderIndex: "asc" } } },
        orderBy: [{ productType: "asc" }, { name: "asc" }],
      }),
    ])

    return ok({
      metrics: {
        openEvents: events.filter((event) => !["RESOLVED", "CLOSED", "ARCHIVED"].includes(event.status)).length,
        openComplaints: complaints.filter((complaint) => !["CLOSED", "ARCHIVED"].includes(complaint.status)).length,
        openIncidents: incidents.filter((incident) => !["CLOSED", "ARCHIVED"].includes(incident.status)).length,
        openSupervisionReviews: supervisionReviews.filter((review) => !["CLOSED", "APPROVED", "ARCHIVED"].includes(review.status)).length,
        pendingExceptions: exceptions.filter((exception) => ["REQUESTED", "IN_REVIEW"].includes(exception.status)).length,
        blockingChecklistItems: checklistResults.filter((result) => result.item?.blocking && ["NOT_STARTED", "EXCEPTION", "TO_REVIEW"].includes(result.status)).length,
        auditReports: auditReports.length,
      },
      events,
      complaints,
      incidents,
      supervisionReviews,
      exceptions,
      checklistResults,
      auditReports,
      activeChecklists,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
