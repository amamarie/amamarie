import { handleApiError, ok } from "@/lib/api-response"
import { evaluateKycProfile } from "@/lib/compliance/kyc-engine"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function severityRank(severity: Severity) {
  return { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }[severity]
}

function scoreForSeverity(severity: Severity) {
  return { CRITICAL: 100, HIGH: 85, MEDIUM: 65, LOW: 40 }[severity]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function isPandaDocFailureStatus(status: unknown) {
  return /declined|expired|deleted|voided|rejected|failed/.test(String(status ?? "").toLowerCase())
}

export async function GET() {
  try {
    const { organizationId } = await getTenantContext()
    const now = new Date()
    const inThirtyDays = new Date(now)
    inThirtyDays.setDate(inThirtyDays.getDate() + 30)
    const recentRiskDate = new Date(now)
    recentRiskDate.setDate(recentRiskDate.getDate() - 14)

    const [
      clients,
      alerts,
      documents,
      vaultDocuments,
      recommendations,
      insuranceAnalyses,
      complianceEvents,
      complaints,
      complianceIncidents,
      supervisionReviews,
      exceptions,
      checklistResults,
      auditReports,
    ] = await Promise.all([
      prisma.client.findMany({
        where: { organizationId, status: { not: "ARCHIVED" } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          advisor: { select: { name: true } },
          status: true,
          riskProfile: true,
          kycCompleted: true,
          identityVerified: true,
          consentGiven: true,
          complianceStatus: true,
          nextReviewDate: true,
          kycProfile: {
            select: {
              id: true,
              status: true,
              complianceScore: true,
              nextKycReviewAt: true,
              sourceOfFunds: true,
              sourceOfWealth: true,
              riskQuestionnaireDate: true,
              advisorOverride: true,
              advisorOverrideReason: true,
              riskProfileResult: true,
              riskTolerance: true,
              riskCapacity: true,
              investmentHorizon: true,
              liquidityNeeds: true,
              investmentKnowledge: true,
              investmentExperience: true,
              borrowingNeeds: true,
              annualIncome: true,
              incomeRange: true,
              netWorth: true,
              liquidNetWorth: true,
              totalAssets: true,
              totalLiabilities: true,
              monthlyExpenses: true,
              emergencyFund: true,
              primaryObjective: true,
              financialGoals: true,
              clientConfirmedNoChange: true,
              advisorAttestation: true,
              lastKycReviewAt: true,
            },
          },
          kybProfile: {
            select: {
              status: true,
              amlRiskLevel: true,
              sourceOfFunds: true,
              sourceOfWealth: true,
              beneficialOwnersDocumented: true,
            },
          },
          documents: {
            where: { status: { in: ["REQUIRED", "REQUESTED", "EXPIRED", "REJECTED"] } },
            select: { id: true, name: true, type: true, status: true, requiredBy: true, expiresAt: true },
            orderBy: [{ status: "asc" }, { requiredBy: "asc" }],
            take: 3,
          },
          tasks: {
            where: { status: { notIn: ["DONE", "CANCELLED", "ARCHIVED"] } },
            select: { id: true },
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 150,
      }),
      prisma.complianceAlert.findMany({
        where: { organizationId, status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: {
          id: true,
          clientId: true,
          type: true,
          severity: true,
          status: true,
          title: true,
          description: true,
          actionLabel: true,
          actionUrl: true,
          createdAt: true,
          client: { select: { firstName: true, lastName: true, advisor: { select: { name: true } } } },
        },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 100,
      }),
      prisma.document.findMany({
        where: { organizationId, status: { in: ["REQUIRED", "REQUESTED", "EXPIRED", "REJECTED"] }, clientId: { not: null } },
        select: {
          id: true,
          clientId: true,
          name: true,
          type: true,
          status: true,
          requiredBy: true,
          expiresAt: true,
          client: { select: { firstName: true, lastName: true, advisor: { select: { name: true } } } },
        },
        orderBy: [{ status: "asc" }, { requiredBy: "asc" }],
        take: 100,
      }),
      prisma.document.findMany({
        where: {
          organizationId,
          clientId: { not: null },
          status: { not: "ARCHIVED" },
          OR: [
            { type: "OTHER", status: { in: ["RECEIVED", "VALIDATED"] } },
            { expiresAt: { lt: now } },
            { sensitivityLevel: { in: ["HIGH", "CRITICAL"] }, consentId: null },
            { containsIdentityData: true, consentId: null },
            { externalSharingEnabled: true },
            { publicLinkActive: true },
            { retentionReviewAt: { lte: now } },
            { extractions: { some: { status: { in: ["PENDING", "PROCESSING", "TO_VALIDATE"] } } } },
          ],
        },
        select: {
          id: true,
          clientId: true,
          name: true,
          type: true,
          status: true,
          sensitivityLevel: true,
          consentId: true,
          containsIdentityData: true,
          externalSharingEnabled: true,
          publicLinkActive: true,
          expiresAt: true,
          retentionReviewAt: true,
          isLocked: true,
          client: { select: { firstName: true, lastName: true, advisor: { select: { name: true } } } },
          extractions: {
            where: { status: { in: ["PENDING", "PROCESSING", "TO_VALIDATE"] } },
            select: { id: true, status: true },
            take: 3,
          },
          links: {
            select: { relationshipType: true },
            take: 5,
          },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 100,
      }),
      prisma.productRecommendation.findMany({
        where: {
          organizationId,
          OR: [
            { status: "OPEN", type: "COMPLIANCE" },
            { status: { in: ["PRESENTED_TO_CLIENT", "CLIENT_ACCEPTED", "SIGNED"] }, reportDocumentId: { not: null } },
          ],
        },
        select: {
          id: true,
          clientId: true,
          type: true,
          status: true,
          title: true,
          reportDocumentId: true,
          presentedToClientAt: true,
          clientSignedAt: true,
          lockedAt: true,
          metadata: true,
          updatedAt: true,
          client: { select: { firstName: true, lastName: true, advisor: { select: { name: true } } } },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 100,
      }),
      prisma.insuranceNeedsAnalysis.findMany({
        where: {
          organizationId,
          status: { in: ["DRAFT", "MISSING_DATA", "IN_ANALYSIS", "ADVISOR_REVIEW", "RECOMMENDATION_PREPARED", "WAITING_CLIENT", "COMPLETED", "DELIVERED", "NEEDS_UPDATE"] },
        },
        select: {
          id: true,
          clientId: true,
          analysisType: true,
          status: true,
          reportDocumentId: true,
          deliveredAt: true,
          signedAt: true,
          lockedAt: true,
          usedForRecommendation: true,
          updatedAt: true,
          client: { select: { firstName: true, lastName: true, advisor: { select: { name: true } } } },
          results: { select: { gapAmount: true }, take: 1 },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 100,
      }),
      prisma.complianceEvent.findMany({
        where: { organizationId, status: { notIn: ["RESOLVED", "CLOSED", "ARCHIVED"] } },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, advisor: { select: { name: true } } } },
          assignedTo: { select: { id: true, name: true, role: true } },
          createdBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
        take: 100,
      }),
      prisma.complaint.findMany({
        where: { organizationId, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, advisor: { select: { name: true } } } },
          assignedTo: { select: { id: true, name: true, role: true } },
        },
        orderBy: [{ severity: "desc" }, { receivedAt: "desc" }],
        take: 50,
      }),
      prisma.complianceIncident.findMany({
        where: { organizationId, status: { notIn: ["CLOSED", "ARCHIVED"] } },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, advisor: { select: { name: true } } } },
          assignedTo: { select: { id: true, name: true, role: true } },
        },
        orderBy: [{ riskLevel: "desc" }, { detectedAt: "desc" }],
        take: 50,
      }),
      prisma.supervisionReview.findMany({
        where: { organizationId, status: { notIn: ["CLOSED", "APPROVED", "ARCHIVED"] } },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, advisor: { select: { name: true } } } },
          reviewer: { select: { id: true, name: true, role: true } },
        },
        orderBy: [{ riskLevel: "desc" }, { createdAt: "desc" }],
        take: 50,
      }),
      prisma.complianceException.findMany({
        where: { organizationId, status: { in: ["REQUESTED", "IN_REVIEW"] } },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, advisor: { select: { name: true } } } },
          requestedBy: { select: { id: true, name: true, role: true } },
        },
        orderBy: [{ riskLevel: "desc" }, { createdAt: "desc" }],
        take: 50,
      }),
      prisma.clientChecklistResult.findMany({
        where: { organizationId, status: { in: ["NOT_STARTED", "EXCEPTION", "TO_REVIEW"] }, item: { blocking: true } },
        include: {
          client: { select: { id: true, firstName: true, lastName: true, advisor: { select: { name: true } } } },
          checklist: { select: { id: true, name: true, productType: true } },
          item: { select: { id: true, label: true, blocking: true, required: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      prisma.auditReport.findMany({
        where: { organizationId },
        include: { client: { select: { id: true, firstName: true, lastName: true } }, createdBy: { select: { id: true, name: true, role: true } } },
        orderBy: { generatedAt: "desc" },
        take: 20,
      }),
    ])

    const issues = [
      ...alerts.map((alert) => ({
        id: `alert-${alert.id}`,
        sourceId: alert.id,
        clientId: alert.clientId,
        clientName: clientName(alert.client),
        advisorName: alert.client.advisor?.name ?? "Non assigné",
        type: alert.type?.toLowerCase().includes("aml") ? "aml_review" : "critical_alert",
        title: alert.title,
        description: alert.description,
        severity: alert.severity as Severity,
        score: scoreForSeverity(alert.severity as Severity),
        status: alert.status,
        createdAt: alert.createdAt.toISOString(),
        primaryHref: alert.actionUrl || `/clients/${alert.clientId}?tab=compliance`,
        primaryLabel: alert.actionLabel || "Ouvrir conformité",
        secondaryHref: `/clients/${alert.clientId}?tab=history`,
      })),
      ...documents.map((document) => ({
        id: `document-${document.id}`,
        sourceId: document.id,
        clientId: document.clientId,
        clientName: document.client ? clientName(document.client) : "Client inconnu",
        advisorName: document.client?.advisor?.name ?? "Non assigné",
        type: "documents",
        title: document.status === "EXPIRED" ? "Document expiré" : "Document requis",
        description: `${document.name} · ${document.type}`,
        severity: document.status === "EXPIRED" ? "HIGH" as Severity : "MEDIUM" as Severity,
        score: document.status === "EXPIRED" ? 85 : 65,
        status: document.status,
        createdAt: (document.requiredBy ?? document.expiresAt ?? now).toISOString(),
        primaryHref: `/clients/${document.clientId}?tab=documents`,
        primaryLabel: "Ouvrir documents",
        secondaryHref: `/documents?status=${document.status.toLowerCase()}`,
      })),
      ...vaultDocuments.map((document) => {
        const hasOpenExtraction = document.extractions.length > 0
        const sensitiveWithoutConsent = !document.consentId && (document.sensitivityLevel === "HIGH" || document.sensitivityLevel === "CRITICAL" || document.containsIdentityData)
        const externalShare = document.externalSharingEnabled || document.publicLinkActive
        const unclassified = document.type === "OTHER" && ["RECEIVED", "VALIDATED"].includes(document.status)
        const expired = Boolean(document.expiresAt && document.expiresAt < now)
        const retentionDue = Boolean(document.retentionReviewAt && document.retentionReviewAt <= now)
        const title = externalShare
          ? "Partage documentaire externe à vérifier"
          : sensitiveWithoutConsent
            ? "Document sensible sans consentement lié"
            : hasOpenExtraction
              ? "Extraction documentaire à valider"
              : retentionDue
                ? "Revue de conservation documentaire due"
              : expired
                ? "Document expiré"
                : unclassified
                  ? "Document reçu non classé"
                  : "Document documentaire à revoir"
        const severity: Severity = externalShare || sensitiveWithoutConsent ? "HIGH" : hasOpenExtraction || expired || retentionDue ? "MEDIUM" : "LOW"
        return {
          id: `vault-document-${document.id}`,
          sourceId: document.id,
          clientId: document.clientId ?? "",
          clientName: document.client ? clientName(document.client) : "Client inconnu",
          advisorName: document.client?.advisor?.name ?? "Non assigné",
          type: "documents",
          title,
          description: retentionDue
            ? `${document.name} · revue prévue le ${document.retentionReviewAt?.toISOString().slice(0, 10)}`
            : `${document.name} · ${document.type} · sensibilité ${document.sensitivityLevel}`,
          severity,
          score: scoreForSeverity(severity),
          status: document.status,
          createdAt: (document.expiresAt ?? now).toISOString(),
          primaryHref: `/clients/${document.clientId}?tab=documents`,
          primaryLabel: "Ouvrir coffre",
          secondaryHref: `/documents`,
        }
      }),
      ...insuranceAnalyses.map((analysis) => {
        const label = {
          LIFE: "Assurance vie",
          DISABILITY: "Invalidité",
          CRITICAL_ILLNESS: "Maladies graves",
          BUSINESS: "Assurance entreprise",
          REPLACEMENT: "Remplacement de contrat",
        }[analysis.analysisType]
        const missingData = analysis.status === "MISSING_DATA"
        const noReport = !analysis.reportDocumentId && ["RECOMMENDATION_PREPARED", "ADVISOR_REVIEW"].includes(analysis.status)
        return {
          id: `insurance-analysis-${analysis.id}`,
          sourceId: analysis.id,
          clientId: analysis.clientId,
          clientName: clientName(analysis.client),
          advisorName: analysis.client.advisor?.name ?? "Non assigné",
          type: "needs_analysis",
          title: missingData ? `Analyse ${label}: données manquantes` : noReport ? `Analyse ${label}: rapport requis` : `Analyse ${label} à finaliser`,
          description: missingData
            ? "Des données critiques doivent être validées avant la recommandation."
            : noReport
              ? "Le rapport daté doit être généré et conservé au dossier."
              : `Statut analyse: ${analysis.status}.`,
          severity: missingData || noReport ? "HIGH" as Severity : "MEDIUM" as Severity,
          score: missingData || noReport ? 85 : 60,
          status: analysis.status,
          createdAt: analysis.updatedAt.toISOString(),
          primaryHref: `/clients/${analysis.clientId}?tab=needs&analysisId=${analysis.id}`,
          primaryLabel: "Ouvrir analyse",
          secondaryHref: `/clients/${analysis.clientId}?tab=documents`,
        }
      }),
      ...recommendations
        .filter((recommendation) => recommendation.type !== "COMPLIANCE" || recommendation.status === "OPEN")
        .map((recommendation) => {
          const pandaDoc = asRecord(asRecord(recommendation.metadata).pandaDoc)
          const signatureFailed = isPandaDocFailureStatus(pandaDoc.status)
          const waitingSignature = Boolean(recommendation.presentedToClientAt && !recommendation.clientSignedAt && !signatureFailed)
          const signedNotLocked = Boolean(recommendation.clientSignedAt && !recommendation.lockedAt)
          const isOpenComplianceRecommendation = recommendation.type === "COMPLIANCE" && recommendation.status === "OPEN"
          const severity: Severity = signatureFailed ? "HIGH" : isOpenComplianceRecommendation || signedNotLocked ? "MEDIUM" : "LOW"
          return {
            id: `recommendation-${recommendation.id}`,
            sourceId: recommendation.id,
            clientId: recommendation.clientId,
            clientName: clientName(recommendation.client),
            advisorName: recommendation.client.advisor?.name ?? "Non assigné",
            type: signatureFailed || waitingSignature || signedNotLocked ? "recommendation_signature" : "critical_alert",
            title: signatureFailed
              ? "Signature de recommandation à relancer"
              : signedNotLocked
                ? "Recommandation signée à finaliser"
                : waitingSignature
                  ? "Signature de recommandation à suivre"
                  : "Recommandation conformité ouverte",
            description: signatureFailed
              ? `PandaDoc a retourné le statut ${String(pandaDoc.status ?? "échec")}.`
              : signedNotLocked
                ? "Le client a signé; le conseiller doit finaliser ou verrouiller la recommandation."
                : waitingSignature
                  ? "Le rapport de recommandation est présenté au client, mais la signature n’est pas encore reçue."
                  : recommendation.title,
            severity,
            score: scoreForSeverity(severity),
            status: recommendation.status,
            createdAt: recommendation.updatedAt.toISOString(),
            primaryHref: `/clients/${recommendation.clientId}?tab=recommendations&recommendationId=${recommendation.id}`,
            primaryLabel: "Ouvrir recommandation",
            secondaryHref: `/clients/${recommendation.clientId}?tab=documents`,
          }
        }),
      ...complianceEvents.map((event) => {
        const severity = (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(event.severity) ? event.severity : event.severity === "IMPORTANT" ? "HIGH" : "MEDIUM") as Severity
        return {
          id: `compliance-event-${event.id}`,
          sourceId: event.id,
          clientId: event.clientId ?? "",
          clientName: event.client ? clientName(event.client) : "Cabinet",
          advisorName: event.client?.advisor?.name ?? event.assignedTo?.name ?? "Non assigné",
          type: event.eventCategory === "COMPLAINT" ? "critical_alert" : event.eventCategory === "INCIDENT" ? "critical_alert" : "critical_alert",
          title: event.eventTitle,
          description: event.description ?? event.eventCategory,
          severity,
          score: scoreForSeverity(severity),
          status: event.status,
          createdAt: event.createdAt.toISOString(),
          primaryHref: event.clientId ? `/clients/${event.clientId}?tab=history` : "/compliance",
          primaryLabel: "Ouvrir événement",
          secondaryHref: "/compliance",
        }
      }),
      ...complaints.map((complaint) => {
        const severity = (complaint.severity === "CRITICAL" || complaint.severity === "HIGH" ? complaint.severity : "MEDIUM") as Severity
        return {
          id: `complaint-${complaint.id}`,
          sourceId: complaint.id,
          clientId: complaint.clientId,
          clientName: clientName(complaint.client),
          advisorName: complaint.client.advisor?.name ?? complaint.assignedTo?.name ?? "Non assigné",
          type: "critical_alert",
          title: `Plainte ouverte ${complaint.complaintNumber}`,
          description: `${complaint.category ?? "Plainte"} · ${complaint.description}`,
          severity,
          score: scoreForSeverity(severity),
          status: complaint.status,
          createdAt: complaint.receivedAt.toISOString(),
          primaryHref: `/clients/${complaint.clientId}?tab=history`,
          primaryLabel: "Ouvrir plainte",
          secondaryHref: "/compliance",
        }
      }),
      ...complianceIncidents.map((incident) => {
        const severity = (incident.seriousHarmRisk ? "CRITICAL" : incident.riskLevel === "HIGH" ? "HIGH" : "MEDIUM") as Severity
        return {
          id: `compliance-incident-${incident.id}`,
          sourceId: incident.id,
          clientId: incident.clientId ?? "",
          clientName: incident.client ? clientName(incident.client) : "Cabinet",
          advisorName: incident.client?.advisor?.name ?? incident.assignedTo?.name ?? "Non assigné",
          type: "critical_alert",
          title: `Incident ${incident.incidentNumber}`,
          description: `${incident.incidentType} · ${incident.description}`,
          severity,
          score: scoreForSeverity(severity),
          status: incident.status,
          createdAt: incident.detectedAt.toISOString(),
          primaryHref: incident.clientId ? `/clients/${incident.clientId}?tab=history` : "/compliance",
          primaryLabel: "Ouvrir incident",
          secondaryHref: "/compliance",
        }
      }),
      ...supervisionReviews.map((review) => {
        const severity = (review.riskLevel === "CRITICAL" || review.riskLevel === "HIGH" ? review.riskLevel : "MEDIUM") as Severity
        return {
          id: `supervision-${review.id}`,
          sourceId: review.id,
          clientId: review.clientId ?? "",
          clientName: review.client ? clientName(review.client) : "Dossier cabinet",
          advisorName: review.client?.advisor?.name ?? review.reviewer?.name ?? "Non assigné",
          type: "critical_alert",
          title: `Revue conformité - ${review.reviewType}`,
          description: review.requiredCorrections ?? review.findings ?? "Revue de supervision ouverte.",
          severity,
          score: scoreForSeverity(severity),
          status: review.status,
          createdAt: review.createdAt.toISOString(),
          primaryHref: review.clientId ? `/clients/${review.clientId}?tab=history` : "/compliance",
          primaryLabel: "Ouvrir revue",
          secondaryHref: "/compliance",
        }
      }),
      ...exceptions.map((exception) => {
        const severity = (exception.riskLevel === "CRITICAL" || exception.riskLevel === "HIGH" ? exception.riskLevel : "MEDIUM") as Severity
        return {
          id: `exception-${exception.id}`,
          sourceId: exception.id,
          clientId: exception.clientId ?? "",
          clientName: exception.client ? clientName(exception.client) : "Dossier cabinet",
          advisorName: exception.client?.advisor?.name ?? exception.requestedBy?.name ?? "Non assigné",
          type: "critical_alert",
          title: `Exception à approuver - ${exception.exceptionType}`,
          description: exception.reason,
          severity,
          score: scoreForSeverity(severity),
          status: exception.status,
          createdAt: exception.createdAt.toISOString(),
          primaryHref: exception.clientId ? `/clients/${exception.clientId}?tab=history` : "/compliance",
          primaryLabel: "Ouvrir exception",
          secondaryHref: "/compliance",
        }
      }),
      ...checklistResults.map((result) => {
        const severity = result.status === "EXCEPTION" ? "HIGH" as Severity : "MEDIUM" as Severity
        return {
          id: `checklist-result-${result.id}`,
          sourceId: result.id,
          clientId: result.clientId,
          clientName: clientName(result.client),
          advisorName: result.client.advisor?.name ?? "Non assigné",
          type: "critical_alert",
          title: `Checklist bloquante - ${result.item?.label ?? result.checklist.name}`,
          description: `${result.checklist.productType} · ${result.status}`,
          severity,
          score: scoreForSeverity(severity),
          status: result.status,
          createdAt: result.updatedAt.toISOString(),
          primaryHref: `/clients/${result.clientId}?tab=history`,
          primaryLabel: "Ouvrir checklist",
          secondaryHref: "/compliance",
        }
      }),
      ...clients.flatMap((client) => {
        const items = []
        const name = clientName(client)
        const advisorName = client.advisor?.name ?? "Non assigné"
        const kycStatus = client.kycProfile?.status
        const kycIncomplete = !client.kycCompleted || !client.kycProfile || ["NOT_STARTED", "IN_PROGRESS", "NEEDS_UPDATE", "REJECTED"].includes(kycStatus ?? "")
        const kycExpired = kycStatus === "EXPIRED" || Boolean(client.kycProfile?.nextKycReviewAt && client.kycProfile.nextKycReviewAt < now)
        const reviewDue = Boolean(client.nextReviewDate && client.nextReviewDate < inThirtyDays) || Boolean(client.kycProfile?.nextKycReviewAt && client.kycProfile.nextKycReviewAt < inThirtyDays)
        const sourceFundsMissing = !client.kycProfile?.sourceOfFunds && !client.kybProfile?.sourceOfFunds
        const sourceWealthMissing = !client.kycProfile?.sourceOfWealth && !client.kybProfile?.sourceOfWealth
        const amlReview = client.complianceStatus === "AML_REVIEW" || client.kybProfile?.amlRiskLevel === "HIGH" || sourceFundsMissing || sourceWealthMissing
        const riskReview = !client.riskProfile || client.riskProfile === "UNKNOWN" || client.kycProfile?.advisorOverride || Boolean(client.kycProfile?.riskQuestionnaireDate && client.kycProfile.riskQuestionnaireDate >= recentRiskDate)

        if (kycIncomplete || kycExpired) {
          items.push({
            id: `kyc-${client.id}`,
            sourceId: client.kycProfile?.id ?? client.id,
            clientId: client.id,
            clientName: name,
            advisorName,
            type: "kyc_incomplete",
            title: kycExpired ? "Profil client expiré ou à revoir" : "Profil client incomplet",
            description: `Statut profil client: ${kycStatus ?? "Aucun profil"}. Score: ${client.kycProfile?.complianceScore ?? 0}/100.`,
            severity: kycExpired ? "HIGH" as Severity : "MEDIUM" as Severity,
            score: kycExpired ? 85 : 65,
            status: kycStatus ?? "MISSING",
            createdAt: (client.kycProfile?.nextKycReviewAt ?? now).toISOString(),
            primaryHref: `/clients/${client.id}?tab=compliance&focus=kyc`,
            primaryLabel: "Ouvrir le profil client",
            secondaryHref: `/clients/${client.id}?tab=profile`,
          })
        }

        if (!client.identityVerified) {
          items.push({
            id: `identity-${client.id}`,
            sourceId: client.id,
            clientId: client.id,
            clientName: name,
            advisorName,
            type: "identity",
            title: "Identité non vérifiée",
            description: "La vérification d’identité doit être confirmée avant une recommandation ou transaction sensible.",
            severity: "HIGH" as Severity,
            score: 80,
            status: "MISSING",
            createdAt: now.toISOString(),
            primaryHref: `/clients/${client.id}?tab=compliance&focus=kyc`,
            primaryLabel: "Ouvrir identité",
            secondaryHref: `/clients/${client.id}?tab=documents`,
          })
        }

        if (!client.consentGiven) {
          items.push({
            id: `consent-${client.id}`,
            sourceId: client.id,
            clientId: client.id,
            clientName: name,
            advisorName,
            type: "consents",
            title: "Consentement conformité manquant",
            description: "Le consentement doit être obtenu ou documenté avant l’utilisation complète du dossier.",
            severity: "HIGH" as Severity,
            score: 80,
            status: "MISSING",
            createdAt: now.toISOString(),
            primaryHref: `/clients/${client.id}?tab=compliance&focus=consents`,
            primaryLabel: "Ouvrir consentements",
            secondaryHref: `/clients/${client.id}?tab=history`,
          })
        }

        if (amlReview) {
          items.push({
            id: `aml-${client.id}`,
            sourceId: client.kybProfile?.status ? client.id : client.kycProfile?.id ?? client.id,
            clientId: client.id,
            clientName: name,
            advisorName,
            type: "aml_review",
            title: "AML / LBA à revoir",
            description: sourceFundsMissing ? "Source des fonds manquante ou non documentée." : sourceWealthMissing ? "Source de richesse manquante ou non documentée." : "Risque AML à valider.",
            severity: sourceFundsMissing ? "HIGH" as Severity : "MEDIUM" as Severity,
            score: sourceFundsMissing ? 85 : 65,
            status: client.complianceStatus ?? "TO_REVIEW",
            createdAt: now.toISOString(),
            primaryHref: `/clients/${client.id}?tab=compliance&focus=alerts`,
            primaryLabel: "Ouvrir AML",
            secondaryHref: `/clients/${client.id}?tab=documents`,
          })
        }

        if (riskReview) {
          items.push({
            id: `risk-${client.id}`,
            sourceId: client.id,
            clientId: client.id,
            clientName: name,
            advisorName,
            type: "risk_profile",
            title: "Profil de risque à valider",
            description: client.kycProfile?.advisorOverride ? "Profil de risque modifié manuellement: justification requise." : "Profil de risque manquant, inconnu ou récemment modifié.",
            severity: client.kycProfile?.advisorOverride ? "HIGH" as Severity : "MEDIUM" as Severity,
            score: client.kycProfile?.advisorOverride ? 80 : 55,
            status: client.riskProfile ?? "UNKNOWN",
            createdAt: (client.kycProfile?.riskQuestionnaireDate ?? now).toISOString(),
            primaryHref: `/clients/${client.id}?tab=compliance&focus=kyc`,
            primaryLabel: "Ouvrir risque",
            secondaryHref: `/clients/${client.id}?tab=profile`,
          })
        }

        if (reviewDue) {
          items.push({
            id: `review-${client.id}`,
            sourceId: client.id,
            clientId: client.id,
            clientName: name,
            advisorName,
            type: "annual_review",
            title: "Révision périodique à planifier",
            description: `Prochaine révision: ${client.nextReviewDate?.toISOString().slice(0, 10) ?? client.kycProfile?.nextKycReviewAt?.toISOString().slice(0, 10) ?? "à planifier"}.`,
            severity: "LOW" as Severity,
            score: 40,
            status: "DUE",
            createdAt: (client.nextReviewDate ?? client.kycProfile?.nextKycReviewAt ?? now).toISOString(),
            primaryHref: `/clients/${client.id}?tab=tasks`,
            primaryLabel: "Créer suivi",
            secondaryHref: `/taches?type=compliance`,
          })
        }

        return items
      }),
    ].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.score - a.score)

    const kycEvaluations = clients.map((client) => ({ clientId: client.id, evaluation: evaluateKycProfile(client.kycProfile) }))
    const metrics = {
      analysesToComplete: insuranceAnalyses.filter((analysis) => ["DRAFT", "MISSING_DATA", "IN_ANALYSIS", "ADVISOR_REVIEW", "NEEDS_UPDATE"].includes(analysis.status)).length,
      replacementsToValidate: insuranceAnalyses.filter((analysis) => analysis.analysisType === "REPLACEMENT" && !["DELIVERED", "USED_FOR_SUBMISSION", "ARCHIVED"].includes(analysis.status)).length,
      reportsToDeliver: insuranceAnalyses.filter((analysis) => !analysis.deliveredAt && ["RECOMMENDATION_PREPARED", "COMPLETED", "WAITING_CLIENT"].includes(analysis.status)).length,
      signaturesToFollow: insuranceAnalyses.filter((analysis) => analysis.deliveredAt && !analysis.signedAt && !analysis.lockedAt).length,
      recommendationSignaturesToFollow: recommendations.filter((recommendation) => recommendation.presentedToClientAt && !recommendation.clientSignedAt && !isPandaDocFailureStatus(asRecord(asRecord(recommendation.metadata).pandaDoc).status)).length,
      recommendationSignatureFailures: recommendations.filter((recommendation) => isPandaDocFailureStatus(asRecord(asRecord(recommendation.metadata).pandaDoc).status)).length,
      recommendationsSignedToFinalize: recommendations.filter((recommendation) => recommendation.clientSignedAt && !recommendation.lockedAt).length,
      kycAwaitingClient: clients.filter((client) => client.kycProfile?.status === "IN_PROGRESS" || !client.kycProfile?.clientConfirmedNoChange).length,
      kycAdvisorReview: clients.filter((client) => client.kycProfile?.status === "PENDING_REVIEW" || !client.kycProfile?.advisorAttestation).length,
      kycInconsistencies: kycEvaluations.filter(({ evaluation }) => evaluation.alerts.some((alert) => alert.type.includes("CONFLICT") || alert.type.includes("LEVERAGE"))).length,
      kycRecommendationBlocked: kycEvaluations.filter(({ evaluation }) => !evaluation.recommendationReady).length,
      openAlerts: alerts.length,
      blockedClients: clients.filter((client) => client.complianceStatus === "BLOCKED").length,
      expiredKyc: clients.filter((client) => client.kycProfile?.status === "EXPIRED" || Boolean(client.kycProfile?.nextKycReviewAt && client.kycProfile.nextKycReviewAt < now)).length,
      requiredDocuments: documents.length,
      unclassifiedDocuments: vaultDocuments.filter((document) => document.type === "OTHER" && ["RECEIVED", "VALIDATED"].includes(document.status)).length,
      sensitiveDocumentsWithoutConsent: vaultDocuments.filter((document) => !document.consentId && (document.sensitivityLevel === "HIGH" || document.sensitivityLevel === "CRITICAL" || document.containsIdentityData)).length,
      documentExtractionsToValidate: vaultDocuments.filter((document) => document.extractions.length > 0).length,
      externallySharedDocuments: vaultDocuments.filter((document) => document.externalSharingEnabled || document.publicLinkActive).length,
      lockedProofDocuments: vaultDocuments.filter((document) => document.isLocked || document.links.some((link) => ["USED_FOR_RECOMMENDATION", "SIGNED_PROOF", "PROOF"].includes(link.relationshipType))).length,
      expiredVaultDocuments: vaultDocuments.filter((document) => Boolean(document.expiresAt && document.expiresAt < now)).length,
      retentionReviewsDue: vaultDocuments.filter((document) => Boolean(document.retentionReviewAt && document.retentionReviewAt <= now)).length,
      missingConsents: clients.filter((client) => !client.consentGiven).length,
      recommendationsNotReady: clients.filter((client) => !client.kycCompleted || !client.identityVerified || !client.consentGiven || client.complianceStatus === "BLOCKED" || client.documents.length > 0).length + recommendations.filter((recommendation) => recommendation.type === "COMPLIANCE" && recommendation.status === "OPEN").length,
      needsAnalysesToReview: insuranceAnalyses.length,
      incompleteKyc: clients.filter((client) => !client.kycCompleted || !client.kycProfile || ["NOT_STARTED", "IN_PROGRESS", "NEEDS_UPDATE", "REJECTED"].includes(client.kycProfile.status)).length,
      amlReview: issues.filter((issue) => issue.type === "aml_review").length,
      annualReviews: issues.filter((issue) => issue.type === "annual_review").length,
      openComplianceEvents: complianceEvents.length,
      openComplaints: complaints.length,
      openComplianceIncidents: complianceIncidents.length,
      supervisionReviewsOpen: supervisionReviews.length,
      exceptionsPending: exceptions.length,
      blockingChecklistItems: checklistResults.length,
      auditReportsGenerated: auditReports.length,
    }

    return ok({
      metrics,
      issues: issues.slice(0, 150),
      complianceCenter: {
        events: complianceEvents.slice(0, 10),
        complaints: complaints.slice(0, 10),
        incidents: complianceIncidents.slice(0, 10),
        supervisionReviews: supervisionReviews.slice(0, 10),
        exceptions: exceptions.slice(0, 10),
        checklistResults: checklistResults.slice(0, 10),
        auditReports,
      },
      generatedAt: now.toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
