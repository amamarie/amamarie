import { createHash } from "crypto"
import type { Prisma } from "@prisma/client"

import { createActivity } from "@/lib/services/activities"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/compliance/audit"

function json(value: unknown): Prisma.InputJsonValue {
  return value === undefined ? {} : value as Prisma.InputJsonValue
}

function year() {
  return new Date().getFullYear()
}

async function nextNumber(prefix: string, organizationId: string, model: "complaint" | "incident") {
  const startsWith = `${prefix}-${year()}-`
  const count = model === "complaint"
    ? await prisma.complaint.count({ where: { organizationId, complaintNumber: { startsWith } } })
    : await prisma.complianceIncident.count({ where: { organizationId, incidentNumber: { startsWith } } })
  return `${startsWith}${String(count + 1).padStart(3, "0")}`
}

export async function createComplianceEvent({
  organizationId,
  userId,
  clientId,
  eventCategory,
  eventTitle,
  description,
  severity = "INFO",
  status = "OPEN",
  assignedToId,
  linkedEntityType,
  linkedEntityId,
  metadata,
}: {
  organizationId: string
  userId?: string | null
  clientId?: string | null
  eventCategory: string
  eventTitle: string
  description?: string | null
  severity?: string
  status?: string
  assignedToId?: string | null
  linkedEntityType?: string | null
  linkedEntityId?: string | null
  metadata?: Prisma.InputJsonValue
}) {
  const event = await prisma.complianceEvent.create({
    data: {
      organizationId,
      clientId,
      createdById: userId,
      assignedToId,
      eventCategory,
      eventTitle,
      description,
      severity,
      status,
      linkedEntityType,
      linkedEntityId,
      metadata,
    },
  })

  await createAuditLog({
    organizationId,
    userId,
    clientId,
    entityType: "ComplianceEvent",
    entityId: event.id,
    action: "COMPLIANCE_EVENT_CREATED",
    newValue: { eventCategory, eventTitle, severity, status },
  })

  return event
}

export async function createComplaint({
  organizationId,
  userId,
  clientId,
  advisorId,
  assignedToId,
  channel,
  productType,
  category,
  description,
  severity = "MEDIUM",
  reportableToAmf = false,
  documents,
}: {
  organizationId: string
  userId: string
  clientId: string
  advisorId?: string | null
  assignedToId?: string | null
  channel?: string | null
  productType?: string | null
  category?: string | null
  description: string
  severity?: string
  reportableToAmf?: boolean
  documents?: Prisma.InputJsonValue
}) {
  const complaint = await prisma.complaint.create({
    data: {
      organizationId,
      clientId,
      advisorId,
      assignedToId,
      complaintNumber: await nextNumber("PL", organizationId, "complaint"),
      channel,
      productType,
      category,
      description,
      severity,
      reportableToAmf,
      documents,
    },
  })
  await createComplianceEvent({
    organizationId,
    userId,
    clientId,
    eventCategory: "COMPLAINT",
    eventTitle: `Plainte ${complaint.complaintNumber} reçue`,
    description,
    severity: severity === "HIGH" || severity === "CRITICAL" ? severity : "IMPORTANT",
    assignedToId,
    linkedEntityType: "Complaint",
    linkedEntityId: complaint.id,
  })
  return complaint
}

export async function createComplianceIncident({
  organizationId,
  userId,
  clientId,
  assignedToId,
  incidentType,
  description,
  occurredAt,
  affectedClientIds,
  dataCategories,
  riskLevel = "TO_ASSESS",
  seriousHarmRisk = false,
  mitigationSteps,
}: {
  organizationId: string
  userId: string
  clientId?: string | null
  assignedToId?: string | null
  incidentType: string
  description: string
  occurredAt?: Date | null
  affectedClientIds?: Prisma.InputJsonValue
  dataCategories?: Prisma.InputJsonValue
  riskLevel?: string
  seriousHarmRisk?: boolean
  mitigationSteps?: string | null
}) {
  const incident = await prisma.complianceIncident.create({
    data: {
      organizationId,
      clientId,
      detectedById: userId,
      assignedToId,
      incidentNumber: await nextNumber("INC", organizationId, "incident"),
      incidentType,
      occurredAt,
      affectedClientIds,
      dataCategories,
      description,
      riskLevel,
      seriousHarmRisk,
      mitigationSteps,
    },
  })
  await createComplianceEvent({
    organizationId,
    userId,
    clientId,
    eventCategory: "INCIDENT",
    eventTitle: `Incident ${incident.incidentNumber} détecté`,
    description,
    severity: seriousHarmRisk ? "CRITICAL" : riskLevel === "HIGH" ? "HIGH" : "IMPORTANT",
    assignedToId,
    linkedEntityType: "ComplianceIncident",
    linkedEntityId: incident.id,
  })
  return incident
}

export async function buildClientAuditReport({ organizationId, userId, clientId }: { organizationId: string; userId: string; clientId: string }) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    include: {
      advisor: { select: { id: true, name: true, email: true, role: true } },
      kycProfile: true,
      kycSnapshots: { orderBy: { createdAt: "desc" }, take: 10 },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100 },
      consents: { include: { purpose: true, template: true }, orderBy: { createdAt: "desc" }, take: 100 },
      productRecommendations: { orderBy: { updatedAt: "desc" }, take: 50 },
      insuranceNeedsAnalyses: { orderBy: { updatedAt: "desc" }, take: 50 },
      noteItems: { orderBy: { createdAt: "desc" }, take: 100 },
      tasks: { orderBy: { createdAt: "desc" }, take: 100 },
      complianceAlerts: { orderBy: { createdAt: "desc" }, take: 100 },
      complianceEvents: { orderBy: { createdAt: "desc" }, take: 100 },
      clientChecklistResults: { include: { checklist: true, item: true }, orderBy: { updatedAt: "desc" }, take: 100 },
      supervisionReviews: { orderBy: { createdAt: "desc" }, take: 50 },
      complianceExceptions: { orderBy: { createdAt: "desc" }, take: 50 },
      complaints: { orderBy: { receivedAt: "desc" }, take: 50 },
      complianceIncidents: { orderBy: { detectedAt: "desc" }, take: 50 },
      amlProfile: {
        include: {
          identityVerifications: { orderBy: { createdAt: "desc" }, take: 20 },
          sourceOfFundsRecords: { orderBy: { createdAt: "desc" }, take: 20 },
          sourceOfWealthRecords: { orderBy: { createdAt: "desc" }, take: 20 },
          thirdPartyDeterminations: { orderBy: { createdAt: "desc" }, take: 20 },
          beneficialOwnershipRecords: { orderBy: { createdAt: "desc" }, take: 30 },
          pepScreenings: { orderBy: { createdAt: "desc" }, take: 20 },
          sanctionsScreenings: { orderBy: { createdAt: "desc" }, take: 20 },
          alerts: { orderBy: { createdAt: "desc" }, take: 50 },
          reviews: { orderBy: { createdAt: "desc" }, take: 20 },
          internalReports: { orderBy: { createdAt: "desc" }, take: 20 },
          scoreComponents: { orderBy: { createdAt: "asc" } },
        },
      },
      dataDisclosures: { orderBy: { disclosedAt: "desc" }, take: 50 },
      privacyRequests: { orderBy: { receivedAt: "desc" }, take: 50 },
      auditLogs: { include: { user: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "desc" }, take: 300 },
    },
  })
  if (!client) throw new Error("CLIENT_NOT_FOUND")

  const summary = {
    client: `${client.firstName} ${client.lastName}`,
    advisor: client.advisor?.name ?? "Non assigné",
    kycStatus: client.kycProfile?.status ?? (client.kycCompleted ? "COMPLETED" : "INCOMPLETE"),
    documents: client.documents.length,
    consents: client.consents.length,
    recommendations: client.productRecommendations.length,
    analyses: client.insuranceNeedsAnalyses.length,
    openAlerts: client.complianceAlerts.filter((alert) => ["OPEN", "IN_PROGRESS"].includes(alert.status)).length,
    complaints: client.complaints.length,
    incidents: client.complianceIncidents.length,
    amlRiskLevel: client.amlProfile?.riskLevel ?? "NON_CONFIGURE",
    amlOpenAlerts: client.amlProfile?.alerts.filter((alert) => !["RESOLVED", "CLOSED", "ARCHIVED"].includes(alert.status)).length ?? 0,
    auditEvents: client.auditLogs.length,
  }
  const sections = {
    client,
    kyc: { profile: client.kycProfile, snapshots: client.kycSnapshots },
    documents: client.documents,
    consents: client.consents,
    recommendations: client.productRecommendations,
    insuranceNeedsAnalyses: client.insuranceNeedsAnalyses,
    notes: client.noteItems,
    tasks: client.tasks,
    complianceAlerts: client.complianceAlerts,
    complianceEvents: client.complianceEvents,
    checklistResults: client.clientChecklistResults,
    supervisionReviews: client.supervisionReviews,
    exceptions: client.complianceExceptions,
    complaints: client.complaints,
    incidents: client.complianceIncidents,
    aml: client.amlProfile,
    disclosures: client.dataDisclosures,
    privacyRequests: client.privacyRequests,
    auditLogs: client.auditLogs,
  }
  const signedHash = createHash("sha256").update(JSON.stringify({ summary, sections })).digest("hex")

  const report = await prisma.auditReport.create({
    data: {
      organizationId,
      clientId,
      createdById: userId,
      reportType: "CLIENT",
      title: `Rapport d'audit - ${client.firstName} ${client.lastName}`,
      summary: json(summary),
      sections: json(sections),
      fileName: `audit-client-${client.id}-${Date.now()}.json`,
      signedHash,
    },
  })
  await createAuditLog({ organizationId, userId, clientId, entityType: "AuditReport", entityId: report.id, action: "AUDIT_REPORT_GENERATED", newValue: { reportType: "CLIENT", signedHash } })
  await createActivity({ organizationId, userId, clientId, type: "AUDIT_LOG_CREATED", title: "Rapport d’audit généré", description: report.title, source: "SYSTEM", entityType: "AuditReport", entityId: report.id })
  return report
}

export async function buildCabinetAuditReport({ organizationId, userId }: { organizationId: string; userId: string }) {
  const [
    organization,
    clients,
    advisors,
    openAlerts,
    complianceEvents,
    complaints,
    incidents,
    supervisionReviews,
    exceptions,
    checklistResults,
    auditLogs,
    consentsMissing,
    documentsMissing,
    amlProfiles,
    amlAlerts,
    amlInternalReports,
    amlReviews,
    amlSanctionsScreenings,
    amlPepScreenings,
  ] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true, slug: true } }),
    prisma.client.findMany({
      where: { organizationId },
      select: { id: true, firstName: true, lastName: true, advisorId: true, complianceStatus: true, kycCompleted: true, nextReviewDate: true, createdAt: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.user.findMany({ where: { organizationId }, select: { id: true, name: true, email: true, role: true } }),
    prisma.complianceAlert.findMany({ where: { organizationId, status: { in: ["OPEN", "IN_PROGRESS"] } }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.complianceEvent.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } }, assignedTo: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.complaint.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } }, assignedTo: { select: { id: true, name: true, role: true } } }, orderBy: { receivedAt: "desc" }, take: 300 }),
    prisma.complianceIncident.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } }, assignedTo: { select: { id: true, name: true, role: true } } }, orderBy: { detectedAt: "desc" }, take: 300 }),
    prisma.supervisionReview.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } }, advisor: { select: { id: true, name: true, role: true } }, reviewer: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.complianceException.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } }, requestedBy: { select: { id: true, name: true, role: true } }, approvedBy: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.clientChecklistResult.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } }, checklist: true, item: true }, orderBy: { updatedAt: "desc" }, take: 500 }),
    prisma.auditLog.findMany({ where: { organizationId }, include: { user: { select: { id: true, name: true, role: true } }, client: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 1000 }),
    prisma.client.count({ where: { organizationId, consentGiven: false } }),
    prisma.document.count({ where: { organizationId, status: { in: ["REQUIRED", "REQUESTED"] } } }),
    prisma.amlProfile.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } }, scoreComponents: true }, orderBy: [{ riskLevel: "desc" }, { updatedAt: "desc" }], take: 500 }),
    prisma.amlAlert.findMany({ where: { organizationId, status: { notIn: ["RESOLVED", "CLOSED", "ARCHIVED"] } }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } } }, orderBy: [{ blocking: "desc" }, { createdAt: "desc" }], take: 500 }),
    prisma.amlInternalReport.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } } }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.amlReview.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } } }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.amlSanctionsScreening.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } } }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.amlPepScreening.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } } }, orderBy: { createdAt: "desc" }, take: 300 }),
  ])

  const openComplaints = complaints.filter((complaint) => !["CLOSED", "ARCHIVED"].includes(complaint.status))
  const openIncidents = incidents.filter((incident) => !["CLOSED", "ARCHIVED"].includes(incident.status))
  const pendingExceptions = exceptions.filter((exception) => ["REQUESTED", "IN_REVIEW"].includes(exception.status))
  const openSupervision = supervisionReviews.filter((review) => !["CLOSED", "APPROVED", "ARCHIVED"].includes(review.status))
  const blockingChecklistItems = checklistResults.filter((result) => result.item?.blocking && ["NOT_STARTED", "TO_REVIEW", "EXCEPTION"].includes(result.status))
  const openAmlAlerts = amlAlerts.filter((alert) => !["RESOLVED", "CLOSED", "ARCHIVED"].includes(alert.status))
  const highRiskAmlProfiles = amlProfiles.filter((profile) => profile.riskLevel === "HIGH")
  const openAmlInternalReports = amlInternalReports.filter((report) => !["CLOSED", "ARCHIVED"].includes(report.status))
  const advisorMetrics = advisors.map((advisor) => {
    const advisorClients = clients.filter((client) => client.advisorId === advisor.id)
    const advisorAlerts = openAlerts.filter((alert) => alert.client?.advisorId === advisor.id)
    return {
      advisor,
      clients: advisorClients.length,
      openAlerts: advisorAlerts.length,
      complaints: complaints.filter((complaint) => complaint.client.advisorId === advisor.id).length,
      incidents: incidents.filter((incident) => incident.client?.advisorId === advisor.id).length,
      exceptions: exceptions.filter((exception) => exception.client?.advisorId === advisor.id).length,
      supervisionReviews: supervisionReviews.filter((review) => review.advisorId === advisor.id || review.client?.advisorId === advisor.id).length,
    }
  })

  const summary = {
    organization: organization?.name ?? organizationId,
    generatedAt: new Date().toISOString(),
    clients: clients.length,
    advisors: advisors.length,
    openAlerts: openAlerts.length,
    missingConsents: consentsMissing,
    missingDocuments: documentsMissing,
    openComplaints: openComplaints.length,
    openIncidents: openIncidents.length,
    openSupervisionReviews: openSupervision.length,
    pendingExceptions: pendingExceptions.length,
    blockingChecklistItems: blockingChecklistItems.length,
    amlHighRiskClients: highRiskAmlProfiles.length,
    amlOpenAlerts: openAmlAlerts.length,
    amlBlockingAlerts: openAmlAlerts.filter((alert) => alert.blocking).length,
    amlOpenInternalReports: openAmlInternalReports.length,
    amlPotentialSanctionsMatches: amlSanctionsScreenings.filter((screening) => screening.result === "POTENTIAL_MATCH" && screening.decision === "PENDING").length,
    amlPepPositive: amlPepScreenings.filter((screening) => screening.result === "POSITIVE").length,
    auditEvents: auditLogs.length,
  }
  const sections = {
    organization,
    advisorMetrics,
    clients,
    openAlerts,
    complianceEvents,
    complaints,
    incidents,
    supervisionReviews,
    exceptions,
    checklistResults,
    amlProfiles,
    amlAlerts,
    amlInternalReports,
    amlReviews,
    amlSanctionsScreenings,
    amlPepScreenings,
    auditLogs,
  }
  const signedHash = createHash("sha256").update(JSON.stringify({ summary, sections })).digest("hex")
  const report = await prisma.auditReport.create({
    data: {
      organizationId,
      createdById: userId,
      reportType: "CABINET",
      title: `Rapport d'audit cabinet - ${organization?.name ?? organizationId}`,
      summary: json(summary),
      sections: json(sections),
      fileName: `audit-cabinet-${organizationId}-${Date.now()}.json`,
      signedHash,
    },
  })
  await createAuditLog({ organizationId, userId, entityType: "AuditReport", entityId: report.id, action: "CABINET_AUDIT_REPORT_GENERATED", newValue: { reportType: "CABINET", signedHash }, sensitivityLevel: "HIGH" })
  await createActivity({ organizationId, userId, type: "AUDIT_LOG_CREATED", title: "Rapport d’audit cabinet généré", description: report.title, source: "SYSTEM", entityType: "AuditReport", entityId: report.id })
  return report
}
