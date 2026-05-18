import { createHash } from "crypto"
import type { Prisma } from "@prisma/client"

import { createAuditLog } from "@/lib/compliance/audit"
import { createComplianceEvent } from "@/lib/compliance/center"
import { prisma } from "@/lib/prisma"

const CLOSED_ALERT_STATUSES = ["RESOLVED", "CLOSED", "ARCHIVED"]
const HIGH_RISK_COUNTRIES = new Set([
  "afghanistan",
  "belarus",
  "iran",
  "myanmar",
  "north korea",
  "russia",
  "syria",
])

type RiskComponent = {
  componentType: string
  label: string
  score: number
  rationale?: string
  metadata?: Prisma.InputJsonValue
}

type AlertInput = {
  alertType: string
  severity: string
  message: string
  triggerRuleKey: string
  blocking?: boolean
  metadata?: Prisma.InputJsonValue
}

function normalizeCountry(value?: string | null) {
  return value?.trim().toLowerCase() ?? ""
}

function riskLevel(score: number) {
  if (score >= 21) return "HIGH"
  if (score >= 11) return "MEDIUM"
  return "LOW"
}

function clientName(client: { firstName: string; lastName: string }) {
  return `${client.firstName} ${client.lastName}`.trim()
}

function signedHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export async function ensureAmlProfile({
  organizationId,
  clientId,
  userId,
  request,
}: {
  organizationId: string
  clientId: string
  userId?: string | null
  request?: Request
}) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    select: { id: true, profileType: true, firstName: true, lastName: true },
  })
  if (!client) throw new Error("CLIENT_NOT_FOUND")

  const existing = await prisma.amlProfile.findUnique({ where: { clientId } })
  if (existing) return existing

  const profile = await prisma.amlProfile.create({
    data: {
      organizationId,
      clientId,
      beneficialOwnershipStatus: client.profileType === "BUSINESS" ? "TO_VERIFY" : "NOT_APPLICABLE",
      riskRationale: "Profil AML créé automatiquement à partir du dossier client.",
    },
  })

  await createAuditLog({
    organizationId,
    userId,
    clientId,
    entityType: "AmlProfile",
    entityId: profile.id,
    action: "AML_PROFILE_CREATED",
    source: "system",
    sensitivityLevel: "HIGH",
    newValue: { status: profile.status, riskLevel: profile.riskLevel },
    request,
  })

  return profile
}

async function upsertOpenAlert({
  organizationId,
  clientId,
  amlProfileId,
  userId,
  alert,
}: {
  organizationId: string
  clientId: string
  amlProfileId: string
  userId?: string | null
  alert: AlertInput
}) {
  const existing = await prisma.amlAlert.findFirst({
    where: {
      organizationId,
      clientId,
      amlProfileId,
      alertType: alert.alertType,
      status: { notIn: CLOSED_ALERT_STATUSES },
    },
  })
  if (existing) {
    return prisma.amlAlert.update({
      where: { id: existing.id },
      data: {
        severity: alert.severity,
        message: alert.message,
        blocking: alert.blocking ?? false,
        triggerRuleKey: alert.triggerRuleKey,
        metadata: alert.metadata,
      },
    })
  }

  const created = await prisma.amlAlert.create({
    data: {
      organizationId,
      clientId,
      amlProfileId,
      alertType: alert.alertType,
      severity: alert.severity,
      message: alert.message,
      triggerRuleKey: alert.triggerRuleKey,
      blocking: alert.blocking ?? false,
      assignedToId: userId ?? undefined,
      metadata: alert.metadata,
    },
  })

  await createComplianceEvent({
    organizationId,
    userId,
    clientId,
    eventCategory: "AML",
    eventTitle: alert.message,
    description: alert.triggerRuleKey,
    severity: alert.severity,
    assignedToId: userId,
    linkedEntityType: "AmlAlert",
    linkedEntityId: created.id,
    metadata: alert.metadata,
  })

  return created
}

async function closeStaleAlerts({
  organizationId,
  clientId,
  amlProfileId,
  activeTypes,
}: {
  organizationId: string
  clientId: string
  amlProfileId: string
  activeTypes: string[]
}) {
  await prisma.amlAlert.updateMany({
    where: {
      organizationId,
      clientId,
      amlProfileId,
      status: { notIn: CLOSED_ALERT_STATUSES },
      alertType: { notIn: activeTypes.length > 0 ? activeTypes : ["__none__"] },
    },
    data: {
      status: "RESOLVED",
      resolutionNote: "Résolu automatiquement après recalcul AML.",
      resolvedAt: new Date(),
    },
  })
}

export async function recalculateAmlRisk({
  organizationId,
  clientId,
  userId,
  request,
}: {
  organizationId: string
  clientId: string
  userId?: string | null
  request?: Request
}) {
  const profile = await ensureAmlProfile({ organizationId, clientId, userId, request })
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profileType: true,
      country: true,
      annualIncome: true,
      approximateIncome: true,
      identityVerified: true,
    },
  })
  if (!client) throw new Error("CLIENT_NOT_FOUND")

  const [
    identityVerifications,
    funds,
    wealth,
    thirdParties,
    beneficialOwners,
    peps,
    sanctions,
    reports,
  ] = await Promise.all([
    prisma.amlIdentityVerification.findMany({ where: { organizationId, clientId, amlProfileId: profile.id }, orderBy: { createdAt: "desc" } }),
    prisma.amlSourceOfFundsRecord.findMany({ where: { organizationId, clientId, amlProfileId: profile.id }, orderBy: { createdAt: "desc" } }),
    prisma.amlSourceOfWealthRecord.findMany({ where: { organizationId, clientId, amlProfileId: profile.id }, orderBy: { createdAt: "desc" } }),
    prisma.amlThirdPartyDetermination.findMany({ where: { organizationId, clientId, amlProfileId: profile.id }, orderBy: { createdAt: "desc" } }),
    prisma.amlBeneficialOwnershipRecord.findMany({ where: { organizationId, clientId, amlProfileId: profile.id }, orderBy: { createdAt: "desc" } }),
    prisma.amlPepScreening.findMany({ where: { organizationId, clientId, amlProfileId: profile.id }, orderBy: { createdAt: "desc" } }),
    prisma.amlSanctionsScreening.findMany({ where: { organizationId, clientId, amlProfileId: profile.id }, orderBy: { createdAt: "desc" } }),
    prisma.amlInternalReport.findMany({
      where: { organizationId, clientId, amlProfileId: profile.id, status: { notIn: ["CLOSED", "ARCHIVED"] } },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const components: RiskComponent[] = []
  const alerts: AlertInput[] = []
  const latestIdentity = identityVerifications[0]
  const latestSanctions = sanctions[0]
  const latestPep = peps[0]

  if (!latestIdentity && !client.identityVerified) {
    components.push({ componentType: "IDENTITY", label: "Identité non vérifiée", score: 6, rationale: "Aucune vérification AML ou preuve d'identité client active." })
    alerts.push({
      alertType: "IDENTITY_REQUIRED",
      severity: "CRITICAL",
      message: "Identité requise non vérifiée.",
      triggerRuleKey: "aml.identity.required",
      blocking: true,
    })
  } else if (latestIdentity?.result === "FAILED") {
    components.push({ componentType: "IDENTITY", label: "Vérification d'identité échouée", score: 10 })
    alerts.push({
      alertType: "IDENTITY_FAILED",
      severity: "CRITICAL",
      message: "Vérification d'identité échouée.",
      triggerRuleKey: "aml.identity.failed",
      blocking: true,
    })
  } else {
    components.push({ componentType: "IDENTITY", label: "Identité documentée", score: 0 })
  }

  const hasHighAmountFunds = funds.some((record) => Number(record.amount ?? 0) >= 100000)
  const missingFundsForHighAmount = hasHighAmountFunds && funds.every((record) => !record.validatedAt)
  if (missingFundsForHighAmount || funds.some((record) => record.coherentWithKyc === "NO")) {
    components.push({ componentType: "SOURCE_OF_FUNDS", label: "Source des fonds à risque", score: 8, rationale: "Montant élevé, incohérence KYC ou validation manquante." })
    alerts.push({
      alertType: "SOURCE_OF_FUNDS_INCOMPLETE",
      severity: "IMPORTANT",
      message: "Source des fonds manquante ou incohérente.",
      triggerRuleKey: "aml.source_of_funds.required",
      blocking: missingFundsForHighAmount,
    })
  } else if (funds.length > 0) {
    components.push({ componentType: "SOURCE_OF_FUNDS", label: "Source des fonds documentée", score: 0 })
  }

  if (wealth.some((record) => record.coherentWithKyc === "NO")) {
    components.push({ componentType: "SOURCE_OF_WEALTH", label: "Source de richesse incohérente", score: 6 })
    alerts.push({
      alertType: "SOURCE_OF_WEALTH_INCONSISTENT",
      severity: "IMPORTANT",
      message: "Source de richesse à revoir.",
      triggerRuleKey: "aml.source_of_wealth.inconsistent",
      blocking: false,
    })
  }

  const thirdPartyIssue = thirdParties.find((record) => record.thirdPartyInvolved || record.thirdPartySuspected)
  if (thirdPartyIssue) {
    const unidentified = thirdPartyIssue.thirdPartyInvolved && (!thirdPartyIssue.thirdPartyName || !thirdPartyIssue.identityVerified)
    components.push({
      componentType: "THIRD_PARTY",
      label: unidentified ? "Tiers non identifié ou non vérifié" : "Tiers impliqué",
      score: unidentified ? 8 : 4,
    })
    alerts.push({
      alertType: unidentified ? "THIRD_PARTY_UNIDENTIFIED" : "THIRD_PARTY_INVOLVED",
      severity: unidentified ? "CRITICAL" : "IMPORTANT",
      message: unidentified ? "Tiers impliqué non identifié ou non vérifié." : "Tiers impliqué dans l'opération.",
      triggerRuleKey: unidentified ? "aml.third_party.unidentified" : "aml.third_party.involved",
      blocking: unidentified,
    })
  }

  if (client.profileType === "BUSINESS") {
    const completeOwners = beneficialOwners.filter((owner) => owner.isBeneficialOwner && owner.confirmedAt)
    if (completeOwners.length === 0) {
      components.push({ componentType: "BENEFICIAL_OWNERSHIP", label: "Bénéficiaires effectifs incomplets", score: 8 })
      alerts.push({
        alertType: "BENEFICIAL_OWNERS_INCOMPLETE",
        severity: "CRITICAL",
        message: "Bénéficiaires effectifs incomplets pour le client entreprise.",
        triggerRuleKey: "aml.beneficial_owners.required",
        blocking: true,
      })
    } else {
      components.push({ componentType: "BENEFICIAL_OWNERSHIP", label: "Bénéficiaires effectifs documentés", score: 0 })
    }
  }

  if (latestPep?.result === "POSITIVE") {
    const isForeignPep = latestPep.pepType === "FOREIGN_PEP"
    components.push({ componentType: "PEP_DOI", label: isForeignPep ? "PPV étrangère positive" : "PPV / DOI positif", score: isForeignPep ? 12 : 8 })
    alerts.push({
      alertType: "PEP_POSITIVE",
      severity: isForeignPep ? "CRITICAL" : "IMPORTANT",
      message: "PPV / DOI positif à revoir par conformité.",
      triggerRuleKey: "aml.pep.positive",
      blocking: !latestPep.reviewedAt,
    })
  } else if (latestPep?.result === "NO_MATCH") {
    components.push({ componentType: "PEP_DOI", label: "Aucun PPV / DOI détecté", score: 0 })
  } else {
    components.push({ componentType: "PEP_DOI", label: "PPV / DOI non vérifié", score: 2 })
  }

  if (latestSanctions?.result === "CONFIRMED_MATCH") {
    components.push({ componentType: "SANCTIONS", label: "Match sanctions confirmé", score: 25 })
    alerts.push({
      alertType: "SANCTIONS_CONFIRMED",
      severity: "CRITICAL",
      message: "Match sanctions confirmé. Opérations bloquées.",
      triggerRuleKey: "aml.sanctions.confirmed",
      blocking: true,
    })
  } else if (latestSanctions?.result === "POTENTIAL_MATCH" || latestSanctions?.decision === "PENDING") {
    components.push({ componentType: "SANCTIONS", label: "Match sanctions potentiel à résoudre", score: 12 })
    alerts.push({
      alertType: "SANCTIONS_POTENTIAL_MATCH",
      severity: "CRITICAL",
      message: "Match sanctions potentiel à revoir.",
      triggerRuleKey: "aml.sanctions.potential_match",
      blocking: true,
    })
  } else if (latestSanctions?.result === "NO_MATCH" || latestSanctions?.decision === "FALSE_POSITIVE") {
    components.push({ componentType: "SANCTIONS", label: "Aucun match sanctions confirmé", score: 0 })
  } else {
    components.push({ componentType: "SANCTIONS", label: "Sanctions non vérifiées", score: 4 })
  }

  const countries = [
    client.country,
    ...funds.map((record) => record.originCountry),
    latestPep?.country,
  ].map(normalizeCountry)
  if (countries.some((country) => HIGH_RISK_COUNTRIES.has(country))) {
    components.push({ componentType: "GEOGRAPHY", label: "Pays à risque élevé", score: 5 })
    alerts.push({
      alertType: "HIGH_RISK_GEOGRAPHY",
      severity: "IMPORTANT",
      message: "Pays ou origine des fonds à risque élevé.",
      triggerRuleKey: "aml.geography.high_risk",
      blocking: false,
    })
  }

  if (reports.length > 0) {
    components.push({ componentType: "INTERNAL_REPORT", label: "Déclaration interne ouverte", score: 6 })
    alerts.push({
      alertType: "INTERNAL_REPORT_OPEN",
      severity: "IMPORTANT",
      message: "Déclaration interne AML ouverte.",
      triggerRuleKey: "aml.internal_report.open",
      blocking: reports.some((report) => report.decision === "PENDING"),
    })
  }

  const totalScore = components.reduce((sum, component) => sum + component.score, 0)
  const forcedHighRisk = alerts.some((alert) => alert.alertType === "SANCTIONS_CONFIRMED")
    || latestPep?.pepType === "FOREIGN_PEP"
    || alerts.some((alert) => ["BENEFICIAL_OWNERS_INCOMPLETE", "THIRD_PARTY_UNIDENTIFIED"].includes(alert.alertType))
  const level = forcedHighRisk ? "HIGH" : riskLevel(totalScore)
  const status = alerts.some((alert) => alert.blocking) ? "BLOCKED" : level === "HIGH" ? "COMPLIANCE_REVIEW" : "ACTIVE"
  const rationale = components
    .filter((component) => component.score > 0)
    .map((component) => `${component.label}: +${component.score}`)
    .join("; ") || "Aucun facteur AML défavorable détecté."

  await prisma.$transaction([
    prisma.amlRiskScoreComponent.deleteMany({ where: { organizationId, clientId, amlProfileId: profile.id } }),
    prisma.amlRiskScoreComponent.createMany({
      data: components.map((component) => ({
        organizationId,
        clientId,
        amlProfileId: profile.id,
        componentType: component.componentType,
        label: component.label,
        score: component.score,
        rationale: component.rationale,
        metadata: component.metadata,
      })),
    }),
  ])

  for (const alert of alerts) {
    await upsertOpenAlert({ organizationId, clientId, amlProfileId: profile.id, userId, alert })
  }
  await closeStaleAlerts({
    organizationId,
    clientId,
    amlProfileId: profile.id,
    activeTypes: alerts.map((alert) => alert.alertType),
  })

  const updated = await prisma.amlProfile.update({
    where: { id: profile.id },
    data: {
      status,
      riskScore: totalScore,
      riskLevel: level,
      riskRationale: rationale,
      identityStatus: latestIdentity?.result === "PASSED" || client.identityVerified ? "VERIFIED" : latestIdentity?.result === "FAILED" ? "FAILED" : "TO_VERIFY",
      sourceOfFundsStatus: funds.length === 0 ? "NOT_REQUIRED" : funds.some((record) => record.validatedAt) ? "VALIDATED" : "TO_REVIEW",
      sourceOfWealthStatus: wealth.length === 0 ? "NOT_REQUIRED" : wealth.some((record) => record.validatedAt) ? "VALIDATED" : "TO_REVIEW",
      thirdPartyStatus: thirdPartyIssue ? thirdPartyIssue.thirdPartyInvolved ? "INVOLVED" : "SUSPECTED" : "NO_THIRD_PARTY",
      beneficialOwnershipStatus: client.profileType === "BUSINESS"
        ? beneficialOwners.some((owner) => owner.isBeneficialOwner && owner.confirmedAt) ? "COMPLETED" : "TO_VERIFY"
        : "NOT_APPLICABLE",
      pepStatus: latestPep?.result === "POSITIVE" ? "POSITIVE" : latestPep?.result === "NO_MATCH" ? "NO_MATCH" : "UNKNOWN",
      sanctionsStatus: latestSanctions?.result === "CONFIRMED_MATCH"
        ? "CONFIRMED_MATCH"
        : latestSanctions?.result === "POTENTIAL_MATCH"
          ? "POTENTIAL_MATCH"
          : latestSanctions?.result === "NO_MATCH" || latestSanctions?.decision === "FALSE_POSITIVE"
            ? "NO_MATCH"
            : "NOT_SCREENED",
      enhancedMonitoring: level === "HIGH",
      seniorReviewRequired: level === "HIGH" || Boolean(latestPep?.seniorManagementReviewRequired),
      nextReviewAt: level === "HIGH"
        ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        : level === "MEDIUM"
          ? new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    include: { scoreComponents: true, alerts: { where: { status: { notIn: CLOSED_ALERT_STATUSES } }, orderBy: { createdAt: "desc" } } },
  })

  await createAuditLog({
    organizationId,
    userId,
    clientId,
    entityType: "AmlProfile",
    entityId: profile.id,
    action: "AML_RISK_RECALCULATED",
    source: "system",
    sensitivityLevel: "HIGH",
    oldValue: { riskScore: profile.riskScore, riskLevel: profile.riskLevel, status: profile.status },
    newValue: { riskScore: updated.riskScore, riskLevel: updated.riskLevel, status: updated.status, rationale },
    request,
  })

  return updated
}

export async function getAmlProfileDetail({ organizationId, clientId }: { organizationId: string; clientId: string }) {
  const profile = await ensureAmlProfile({ organizationId, clientId })
  return prisma.amlProfile.findFirst({
    where: { id: profile.id, organizationId, clientId },
    include: {
      identityVerifications: { orderBy: { createdAt: "desc" }, take: 20 },
      sourceOfFundsRecords: { orderBy: { createdAt: "desc" }, take: 20 },
      sourceOfWealthRecords: { orderBy: { createdAt: "desc" }, take: 20 },
      thirdPartyDeterminations: { orderBy: { createdAt: "desc" }, take: 20 },
      beneficialOwnershipRecords: { orderBy: { createdAt: "desc" }, take: 30 },
      pepScreenings: { orderBy: { createdAt: "desc" }, take: 20 },
      sanctionsScreenings: { orderBy: { createdAt: "desc" }, take: 20 },
      alerts: { where: { status: { notIn: CLOSED_ALERT_STATUSES } }, orderBy: { createdAt: "desc" }, take: 50 },
      reviews: { orderBy: { createdAt: "desc" }, take: 20 },
      internalReports: { orderBy: { createdAt: "desc" }, take: 20 },
      scoreComponents: { orderBy: { createdAt: "asc" } },
      monitoringEvents: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  })
}

export async function getAmlDashboard({ organizationId }: { organizationId: string }) {
  const [
    highRiskClients,
    potentialSanctions,
    pepToReview,
    fundsMissing,
    beneficialIncomplete,
    reportsOpen,
    reviewsRequired,
    alerts,
  ] = await Promise.all([
    prisma.amlProfile.count({ where: { organizationId, riskLevel: "HIGH" } }),
    prisma.amlAlert.count({ where: { organizationId, alertType: { in: ["SANCTIONS_POTENTIAL_MATCH", "SANCTIONS_CONFIRMED"] }, status: { notIn: CLOSED_ALERT_STATUSES } } }),
    prisma.amlAlert.count({ where: { organizationId, alertType: "PEP_POSITIVE", status: { notIn: CLOSED_ALERT_STATUSES } } }),
    prisma.amlAlert.count({ where: { organizationId, alertType: "SOURCE_OF_FUNDS_INCOMPLETE", status: { notIn: CLOSED_ALERT_STATUSES } } }),
    prisma.amlAlert.count({ where: { organizationId, alertType: "BENEFICIAL_OWNERS_INCOMPLETE", status: { notIn: CLOSED_ALERT_STATUSES } } }),
    prisma.amlInternalReport.count({ where: { organizationId, status: { notIn: ["CLOSED", "ARCHIVED"] } } }),
    prisma.amlProfile.count({ where: { organizationId, seniorReviewRequired: true } }),
    prisma.amlAlert.findMany({
      where: { organizationId, status: { notIn: CLOSED_ALERT_STATUSES } },
      include: { client: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
      take: 25,
    }),
  ])

  return {
    metrics: {
      highRiskClients,
      potentialSanctions,
      pepToReview,
      fundsMissing,
      beneficialIncomplete,
      reportsOpen,
      reviewsRequired,
      monitoringEventsOpen: await prisma.amlMonitoringEvent.count({ where: { organizationId, status: { notIn: ["RESOLVED", "CLOSED", "ARCHIVED"] } } }),
    },
    alerts: alerts.map((alert) => ({
      ...alert,
      clientName: clientName(alert.client),
    })),
  }
}

export async function createAmlMonitoringEvent({
  organizationId,
  clientId,
  userId,
  eventType,
  eventTitle,
  description,
  sourceEntityType,
  sourceEntityId,
  amount,
  currency = "CAD",
  country,
  triggerRuleKey,
  riskImpact = 0,
  metadata,
  request,
}: {
  organizationId: string
  clientId: string
  userId?: string | null
  eventType: string
  eventTitle: string
  description?: string | null
  sourceEntityType?: string | null
  sourceEntityId?: string | null
  amount?: number | null
  currency?: string
  country?: string | null
  triggerRuleKey?: string | null
  riskImpact?: number
  metadata?: Prisma.InputJsonValue
  request?: Request
}) {
  const profile = await ensureAmlProfile({ organizationId, clientId, userId, request })
  const event = await prisma.amlMonitoringEvent.create({
    data: {
      organizationId,
      clientId,
      amlProfileId: profile.id,
      eventType,
      eventTitle,
      description,
      sourceEntityType,
      sourceEntityId,
      amount: typeof amount === "number" ? amount : undefined,
      currency,
      country,
      triggerRuleKey,
      riskImpact,
      metadata,
    },
  })

  await createAuditLog({
    organizationId,
    userId,
    clientId,
    entityType: "AmlMonitoringEvent",
    entityId: event.id,
    action: "AML_MONITORING_EVENT_CREATED",
    newValue: { eventType, eventTitle, riskImpact, amount, country },
    source: "system",
    sensitivityLevel: "HIGH",
    request,
  })

  if (riskImpact >= 5) {
    await upsertOpenAlert({
      organizationId,
      clientId,
      amlProfileId: profile.id,
      userId,
      alert: {
        alertType: "AML_MONITORING_EVENT",
        severity: riskImpact >= 8 ? "CRITICAL" : "IMPORTANT",
        message: eventTitle,
        triggerRuleKey: triggerRuleKey ?? "aml.monitoring.event",
        blocking: riskImpact >= 8,
        metadata: { eventId: event.id },
      },
    })
  }

  await recalculateAmlRisk({ organizationId, clientId, userId, request })
  return event
}

export async function ensureDefaultAmlRiskRules({ organizationId, userId }: { organizationId: string; userId?: string | null }) {
  const defaults = [
    { ruleKey: "aml.identity.required", name: "Identité requise", category: "IDENTITY", severity: "CRITICAL", blocking: true, scoreImpact: 6 },
    { ruleKey: "aml.source_of_funds.required", name: "Source des fonds requise", category: "SOURCE_OF_FUNDS", severity: "IMPORTANT", blocking: true, scoreImpact: 8 },
    { ruleKey: "aml.third_party.unidentified", name: "Tiers non identifié", category: "THIRD_PARTY", severity: "CRITICAL", blocking: true, scoreImpact: 8 },
    { ruleKey: "aml.beneficial_owners.required", name: "Bénéficiaires effectifs requis", category: "BENEFICIAL_OWNERSHIP", severity: "CRITICAL", blocking: true, scoreImpact: 8 },
    { ruleKey: "aml.pep.positive", name: "PPV / DOI positif", category: "PEP_DOI", severity: "IMPORTANT", blocking: true, scoreImpact: 8 },
    { ruleKey: "aml.sanctions.potential_match", name: "Match sanctions potentiel", category: "SANCTIONS", severity: "CRITICAL", blocking: true, scoreImpact: 12 },
    { ruleKey: "aml.sanctions.confirmed", name: "Match sanctions confirmé", category: "SANCTIONS", severity: "CRITICAL", blocking: true, scoreImpact: 25 },
    { ruleKey: "aml.monitoring.event", name: "Surveillance continue AML", category: "MONITORING", severity: "IMPORTANT", blocking: false, scoreImpact: 5 },
  ]

  const results = []
  for (const rule of defaults) {
    results.push(await prisma.amlRiskRule.upsert({
      where: { organizationId_ruleKey: { organizationId, ruleKey: rule.ruleKey } },
      update: {},
      create: {
        organizationId,
        createdById: userId,
        ...rule,
        description: `Règle AML standard: ${rule.name}.`,
        condition: { default: true },
        action: { createAlert: true, recalculateRisk: true },
      },
    }))
  }
  return results
}

export async function buildClientAmlReport({ organizationId, userId, clientId }: { organizationId: string; userId: string; clientId: string }) {
  const profile = await getAmlProfileDetail({ organizationId, clientId })
  if (!profile) throw new Error("AML_PROFILE_NOT_FOUND")
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    select: { id: true, firstName: true, lastName: true, profileType: true, advisor: { select: { id: true, name: true, role: true } } },
  })
  if (!client) throw new Error("CLIENT_NOT_FOUND")

  const summary = {
    client: clientName(client),
    profileType: client.profileType,
    advisor: client.advisor?.name ?? "Non assigné",
    riskScore: profile.riskScore,
    riskLevel: profile.riskLevel,
    status: profile.status,
    openAlerts: profile.alerts.length,
    sanctionsStatus: profile.sanctionsStatus,
    pepStatus: profile.pepStatus,
    generatedAt: new Date().toISOString(),
  }
  const sections = { client, aml: profile }
  const hash = signedHash({ summary, sections })
  const report = await prisma.auditReport.create({
    data: {
      organizationId,
      clientId,
      createdById: userId,
      reportType: "AML_CLIENT",
      title: `Rapport AML - ${clientName(client)}`,
      summary: summary as Prisma.InputJsonValue,
      sections: sections as Prisma.InputJsonValue,
      fileName: `aml-client-${clientId}-${Date.now()}.json`,
      signedHash: hash,
      metadata: { exportFormat: "JSON_SIGNED", inspectionReady: true },
    },
  })
  await createAuditLog({
    organizationId,
    userId,
    clientId,
    entityType: "AuditReport",
    entityId: report.id,
    action: "AML_CLIENT_REPORT_GENERATED",
    newValue: { reportType: "AML_CLIENT", signedHash: hash },
    sensitivityLevel: "HIGH",
  })
  return report
}

export async function buildCabinetAmlReport({ organizationId, userId }: { organizationId: string; userId: string }) {
  const [dashboard, profiles, alerts, internalReports, monitoringEvents, rules] = await Promise.all([
    getAmlDashboard({ organizationId }),
    prisma.amlProfile.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } }, scoreComponents: true }, orderBy: [{ riskLevel: "desc" }, { updatedAt: "desc" }], take: 1000 }),
    prisma.amlAlert.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } } }, orderBy: { createdAt: "desc" }, take: 1000 }),
    prisma.amlInternalReport.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } } }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.amlMonitoringEvent.findMany({ where: { organizationId }, include: { client: { select: { id: true, firstName: true, lastName: true, advisorId: true } } }, orderBy: { createdAt: "desc" }, take: 1000 }),
    prisma.amlRiskRule.findMany({ where: { organizationId }, orderBy: [{ category: "asc" }, { ruleKey: "asc" }] }),
  ])
  const summary = {
    generatedAt: new Date().toISOString(),
    ...dashboard.metrics,
    profiles: profiles.length,
    alerts: alerts.length,
    internalReports: internalReports.length,
    monitoringEvents: monitoringEvents.length,
    rules: rules.length,
  }
  const sections = { dashboard, profiles, alerts, internalReports, monitoringEvents, rules }
  const hash = signedHash({ summary, sections })
  const report = await prisma.auditReport.create({
    data: {
      organizationId,
      createdById: userId,
      reportType: "AML_CABINET",
      title: "Rapport AML cabinet",
      summary: summary as Prisma.InputJsonValue,
      sections: sections as Prisma.InputJsonValue,
      fileName: `aml-cabinet-${organizationId}-${Date.now()}.json`,
      signedHash: hash,
      metadata: { exportFormat: "JSON_SIGNED", inspectionReady: true },
    },
  })
  await createAuditLog({
    organizationId,
    userId,
    entityType: "AuditReport",
    entityId: report.id,
    action: "AML_CABINET_REPORT_GENERATED",
    newValue: { reportType: "AML_CABINET", signedHash: hash },
    sensitivityLevel: "HIGH",
  })
  return report
}
