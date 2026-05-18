import { createHash } from "node:crypto"

import type { ClientKycProfile, Prisma } from "@prisma/client"

import { evaluateKycProfile } from "@/lib/compliance/kyc-engine"
import { prisma } from "@/lib/prisma"

type KycWithClient = ClientKycProfile & {
  client?: { id: string; advisorId?: string | null; organizationId: string } | null
}

const autoQuestionIds = [
  "risk_tolerance",
  "risk_capacity",
  "investment_horizon",
  "liquidity_needs",
  "investment_knowledge",
  "borrowing_needs",
]

const riskScoreMap: Record<string, number> = {
  CONSERVATIVE: 1,
  LOW: 1,
  MODERATE_LOW: 2,
  MEDIUM: 3,
  MODERATE: 3,
  BALANCED: 3,
  GROWTH: 4,
  AGGRESSIVE: 5,
  HIGH: 5,
}

function riskScore(value?: string | null) {
  if (!value) return null
  return riskScoreMap[String(value).toUpperCase()] ?? null
}

function parseExperience(value?: string | null): Prisma.InputJsonValue | undefined {
  if (!value) return undefined
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function splitGoals(value?: string | null) {
  if (!value) return []
  return value
    .split(/\n|;|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function goalTypeFromLabel(label: string) {
  const normalized = label.toLowerCase()
  if (normalized.includes("retraite")) return "RETIREMENT"
  if (normalized.includes("urgence") || normalized.includes("liquid")) return "LIQUIDITY"
  if (normalized.includes("succession")) return "ESTATE"
  if (normalized.includes("education") || normalized.includes("étude") || normalized.includes("etude")) return "EDUCATION"
  if (normalized.includes("maison") || normalized.includes("mise de fonds") || normalized.includes("hypothe")) return "HOME_PURCHASE"
  if (normalized.includes("protection") || normalized.includes("assurance")) return "PROTECTION"
  return "OTHER"
}

export async function ensureKycPolicySettings(organizationId: string) {
  return prisma.kycPolicySettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  })
}

export async function logKycAccess({
  organizationId,
  clientId,
  userId,
  accessType,
  purpose,
  sensitiveFields,
  masked = true,
  exportFormat,
  ipAddress,
  userAgent,
  metadata,
}: {
  organizationId: string
  clientId?: string | null
  userId?: string | null
  accessType: string
  purpose: string
  sensitiveFields?: Prisma.InputJsonValue
  masked?: boolean
  exportFormat?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Prisma.InputJsonValue
}) {
  const settings = await ensureKycPolicySettings(organizationId)
  if (!settings.accessLogEnabled) return null
  return prisma.kycAccessLog.create({
    data: {
      organizationId,
      clientId,
      userId,
      accessType,
      purpose,
      sensitiveFields,
      masked,
      exportFormat,
      ipAddress,
      userAgent,
      metadata,
    },
  })
}

export async function syncAdvancedKycArtifacts({
  organizationId,
  clientId,
  userId,
  kyc,
}: {
  organizationId: string
  clientId: string
  userId?: string | null
  kyc: KycWithClient
}) {
  const evaluation = evaluateKycProfile(kyc)
  await ensureKycPolicySettings(organizationId)

  await prisma.investmentProfile.upsert({
    where: { clientId },
    create: {
      organizationId,
      clientId,
      kycProfileId: kyc.id,
      profileType: kyc.subjectType,
      primaryObjective: kyc.primaryObjective,
      secondaryObjectives: kyc.secondaryObjectives as Prisma.InputJsonValue | undefined,
      investmentKnowledge: kyc.investmentKnowledge,
      investmentExperience: parseExperience(kyc.investmentExperience),
      riskToleranceScore: riskScore(kyc.riskTolerance),
      riskCapacityScore: riskScore(kyc.riskCapacity),
      finalRiskScore: evaluation.finalRiskScore,
      finalRiskProfile: evaluation.finalRiskProfile,
      riskProfileRationale: kyc.advisorOverride ? kyc.advisorOverrideReason : "Profil calculé selon le plus prudent entre tolérance, capacité, horizon et liquidité.",
      timeHorizon: kyc.investmentHorizon,
      liquidityNeeds: kyc.liquidityNeeds,
      usesLeverage: /YES|OUI|LEVER|EMPRUNT/i.test(kyc.borrowingNeeds ?? ""),
      leverageDetails: kyc.borrowingNeeds,
      clientConfirmedAt: kyc.clientConfirmedNoChange ? (kyc.approvedAt ?? kyc.updatedAt) : null,
      advisorValidatedAt: kyc.advisorAttestationAt ?? kyc.approvedAt,
    },
    update: {
      kycProfileId: kyc.id,
      profileType: kyc.subjectType,
      primaryObjective: kyc.primaryObjective,
      secondaryObjectives: kyc.secondaryObjectives as Prisma.InputJsonValue | undefined,
      investmentKnowledge: kyc.investmentKnowledge,
      investmentExperience: parseExperience(kyc.investmentExperience),
      riskToleranceScore: riskScore(kyc.riskTolerance),
      riskCapacityScore: riskScore(kyc.riskCapacity),
      finalRiskScore: evaluation.finalRiskScore,
      finalRiskProfile: evaluation.finalRiskProfile,
      riskProfileRationale: kyc.advisorOverride ? kyc.advisorOverrideReason : "Profil calculé selon le plus prudent entre tolérance, capacité, horizon et liquidité.",
      timeHorizon: kyc.investmentHorizon,
      liquidityNeeds: kyc.liquidityNeeds,
      usesLeverage: /YES|OUI|LEVER|EMPRUNT/i.test(kyc.borrowingNeeds ?? ""),
      leverageDetails: kyc.borrowingNeeds,
      clientConfirmedAt: kyc.clientConfirmedNoChange ? (kyc.approvedAt ?? kyc.updatedAt) : null,
      advisorValidatedAt: kyc.advisorAttestationAt ?? kyc.approvedAt,
    },
  })

  const existingGoals = await prisma.financialGoal.count({ where: { organizationId, clientId } })
  if (existingGoals === 0) {
    const goals = splitGoals(kyc.financialGoals)
    if (goals.length > 0) {
      await prisma.financialGoal.createMany({
        data: goals.map((goal, index) => ({
          organizationId,
          clientId,
          kycProfileId: kyc.id,
          goalName: goal,
          goalType: goalTypeFromLabel(goal),
          priority: index === 0 ? "HIGH" : "MEDIUM",
          liquidityNeed: kyc.liquidityNeeds,
          riskLevelForGoal: evaluation.finalRiskProfile,
          source: "KYC_PROFILE",
          lastReviewedAt: kyc.lastKycReviewAt ?? new Date(),
        })),
      })
    } else if (kyc.primaryObjective) {
      await prisma.financialGoal.create({
        data: {
          organizationId,
          clientId,
          kycProfileId: kyc.id,
          goalName: kyc.primaryObjective,
          goalType: goalTypeFromLabel(kyc.primaryObjective),
          priority: "HIGH",
          liquidityNeed: kyc.liquidityNeeds,
          riskLevelForGoal: evaluation.finalRiskProfile,
          source: "KYC_PROFILE",
          lastReviewedAt: kyc.lastKycReviewAt ?? new Date(),
        },
      })
    }
  }

  await prisma.riskQuestionnaireAnswer.deleteMany({
    where: { organizationId, clientId, kycProfileId: kyc.id, questionId: { in: autoQuestionIds } },
  })
  await prisma.riskQuestionnaireAnswer.createMany({
    data: [
      { questionId: "risk_tolerance", questionLabel: "Tolérance au risque", questionCategory: "tolerance", answerValue: kyc.riskTolerance ?? "UNKNOWN", score: riskScore(kyc.riskTolerance) },
      { questionId: "risk_capacity", questionLabel: "Capacité de risque", questionCategory: "capacity", answerValue: kyc.riskCapacity ?? "UNKNOWN", score: riskScore(kyc.riskCapacity) },
      { questionId: "investment_horizon", questionLabel: "Horizon de placement", questionCategory: "horizon", answerValue: kyc.investmentHorizon ?? "UNKNOWN", score: null },
      { questionId: "liquidity_needs", questionLabel: "Besoin de liquidité", questionCategory: "liquidity", answerValue: kyc.liquidityNeeds ?? "UNKNOWN", score: null },
      { questionId: "investment_knowledge", questionLabel: "Connaissances financières", questionCategory: "knowledge", answerValue: kyc.investmentKnowledge ?? "UNKNOWN", score: null },
      { questionId: "borrowing_needs", questionLabel: "Levier / emprunt pour investir", questionCategory: "leverage", answerValue: kyc.borrowingNeeds ?? "UNKNOWN", score: null },
    ].map((answer) => ({
      organizationId,
      clientId,
      kycProfileId: kyc.id,
      answeredById: userId,
      ...answer,
    })),
  })

  await Promise.all(evaluation.alerts.map((alert) => prisma.kycAlert.upsert({
    where: { clientId_alertType_status: { clientId, alertType: alert.type, status: "OPEN" } },
    create: {
      organizationId,
      clientId,
      kycProfileId: kyc.id,
      alertType: alert.type,
      severity: alert.severity,
      status: "OPEN",
      title: alert.title,
      message: alert.description,
      triggerRuleId: alert.type,
    },
    update: {
      kycProfileId: kyc.id,
      severity: alert.severity,
      title: alert.title,
      message: alert.description,
      triggerRuleId: alert.type,
    },
  })))

  await logKycAccess({
    organizationId,
    clientId,
    userId,
    accessType: "KYC_SYNC",
    purpose: "Synchronisation du profil client structuré avec les objets avancés.",
    sensitiveFields: ["income", "netWorth", "liabilities", "riskProfile", "sourceOfFunds"],
    masked: true,
    metadata: { completionScore: evaluation.completionScore, recommendationReady: evaluation.recommendationReady },
  })

  return evaluation
}

export async function createKycVersion({
  organizationId,
  clientId,
  userId,
  kycProfileId,
  sourceSnapshotId,
  snapshotData,
  scoresSnapshot,
  alertsSnapshot,
  clientConfirmedAt,
  advisorValidatedAt,
  locked = true,
}: {
  organizationId: string
  clientId: string
  userId?: string | null
  kycProfileId?: string | null
  sourceSnapshotId?: string | null
  snapshotData: Prisma.InputJsonValue
  scoresSnapshot?: Prisma.InputJsonValue
  alertsSnapshot?: Prisma.InputJsonValue
  clientConfirmedAt?: Date | null
  advisorValidatedAt?: Date | null
  locked?: boolean
}) {
  const last = await prisma.kycVersion.findFirst({
    where: { organizationId, clientId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  })
  const versionNumber = (last?.versionNumber ?? 0) + 1
  const payload = { snapshotData, scoresSnapshot, alertsSnapshot, versionNumber }
  return prisma.kycVersion.create({
    data: {
      organizationId,
      clientId,
      kycProfileId,
      sourceSnapshotId,
      versionNumber,
      snapshotData,
      scoresSnapshot,
      alertsSnapshot,
      clientConfirmedAt,
      advisorValidatedAt,
      lockedAt: locked ? new Date() : null,
      lockedById: locked ? userId : null,
      integrityHash: hashPayload(payload),
    },
  })
}

export async function ensureKycVersionForRecommendation({
  organizationId,
  clientId,
  userId,
}: {
  organizationId: string
  clientId: string
  userId?: string | null
}) {
  const latest = await prisma.kycVersion.findFirst({
    where: { organizationId, clientId, lockedAt: { not: null } },
    orderBy: { versionNumber: "desc" },
  })
  if (latest) return latest

  const kyc = await prisma.clientKycProfile.findFirst({ where: { organizationId, clientId } })
  if (!kyc) return null
  const evaluation = evaluateKycProfile(kyc)
  return createKycVersion({
    organizationId,
    clientId,
    userId,
    kycProfileId: kyc.id,
    snapshotData: kyc as unknown as Prisma.InputJsonValue,
    scoresSnapshot: {
      completionScore: evaluation.completionScore,
      freshnessScore: evaluation.freshnessScore,
      coherenceScore: evaluation.coherenceScore,
      finalRiskProfile: evaluation.finalRiskProfile,
      recommendationReady: evaluation.recommendationReady,
    },
    alertsSnapshot: evaluation.alerts as unknown as Prisma.InputJsonValue,
    clientConfirmedAt: kyc.clientConfirmedNoChange ? (kyc.approvedAt ?? kyc.updatedAt) : null,
    advisorValidatedAt: kyc.advisorAttestationAt ?? kyc.approvedAt,
    locked: true,
  })
}
