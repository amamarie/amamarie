import { prisma } from "@/lib/prisma"

export type ComplianceWorkflowAction =
  | "EXTERNAL_DOCUMENT_SHARE"
  | "INSURANCE_ANALYSIS_LOCK"
  | "RECOMMENDATION_LOCK"

export type ComplianceBlocker = {
  type: string
  id: string
  title: string
  severity: string
}

export class ComplianceWorkflowBlockedError extends Error {
  blockers: ComplianceBlocker[]

  constructor(blockers: ComplianceBlocker[]) {
    super("COMPLIANCE_WORKFLOW_BLOCKED")
    this.name = "ComplianceWorkflowBlockedError"
    this.blockers = blockers
  }
}

export async function getComplianceWorkflowBlockers({
  organizationId,
  clientId,
}: {
  organizationId: string
  clientId: string
}) {
  const [alerts, amlAlerts, complaints, incidents, supervisionReviews, checklistResults, exceptions] = await Promise.all([
    prisma.complianceAlert.findMany({
      where: { organizationId, clientId, status: { in: ["OPEN", "IN_PROGRESS"] }, severity: "CRITICAL" },
      select: { id: true, title: true, severity: true },
      take: 10,
    }),
    prisma.amlAlert.findMany({
      where: { organizationId, clientId, status: { notIn: ["RESOLVED", "CLOSED", "ARCHIVED"] }, blocking: true },
      select: { id: true, message: true, severity: true, alertType: true },
      take: 10,
    }),
    prisma.complaint.findMany({
      where: { organizationId, clientId, status: { not: "CLOSED" } },
      select: { id: true, complaintNumber: true, category: true, severity: true },
      take: 10,
    }),
    prisma.complianceIncident.findMany({
      where: { organizationId, clientId, status: { not: "CLOSED" } },
      select: { id: true, incidentNumber: true, incidentType: true, riskLevel: true, seriousHarmRisk: true },
      take: 10,
    }),
    prisma.supervisionReview.findMany({
      where: { organizationId, clientId, status: { notIn: ["APPROVED", "CLOSED"] } },
      select: { id: true, reviewType: true, riskLevel: true },
      take: 10,
    }),
    prisma.clientChecklistResult.findMany({
      where: {
        organizationId,
        clientId,
        status: { in: ["NOT_STARTED", "TO_REVIEW", "EXCEPTION"] },
        item: { blocking: true },
      },
      select: { id: true, status: true, item: { select: { label: true } } },
      take: 10,
    }),
    prisma.complianceException.findMany({
      where: { organizationId, clientId, status: { in: ["PENDING", "REJECTED"] } },
      select: { id: true, exceptionType: true, riskLevel: true, status: true },
      take: 10,
    }),
  ])

  const blockers: ComplianceBlocker[] = [
    ...alerts.map((alert) => ({ type: "ALERTE_CRITIQUE", id: alert.id, title: alert.title, severity: alert.severity })),
    ...amlAlerts.map((alert) => ({ type: "ALERTE_AML_BLOQUANTE", id: alert.id, title: `${alert.alertType} - ${alert.message}`, severity: alert.severity })),
    ...complaints.map((complaint) => ({ type: "PLAINTE_OUVERTE", id: complaint.id, title: `${complaint.complaintNumber} - ${complaint.category ?? "Plainte"}`, severity: complaint.severity })),
    ...incidents.map((incident) => ({ type: "INCIDENT_OUVERT", id: incident.id, title: `${incident.incidentNumber} - ${incident.incidentType}`, severity: incident.seriousHarmRisk ? "CRITICAL" : incident.riskLevel })),
    ...supervisionReviews.map((review) => ({ type: "SUPERVISION_OUVERTE", id: review.id, title: review.reviewType, severity: review.riskLevel })),
    ...checklistResults.map((result) => ({ type: "CHECKLIST_BLOQUANTE", id: result.id, title: result.item?.label ?? "Item de checklist bloquant", severity: "IMPORTANT" })),
    ...exceptions.map((exception) => ({ type: "EXCEPTION_NON_APPROUVEE", id: exception.id, title: `${exception.exceptionType} - ${exception.status}`, severity: exception.riskLevel })),
  ]

  return blockers
}

export async function assertComplianceWorkflowClear({
  organizationId,
  clientId,
}: {
  organizationId: string
  clientId?: string | null
  action: ComplianceWorkflowAction
}) {
  if (!clientId) return
  const blockers = await getComplianceWorkflowBlockers({ organizationId, clientId })
  if (blockers.length > 0) throw new ComplianceWorkflowBlockedError(blockers)
}
