import { Prisma, type ClientProfileType } from "@prisma/client"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { createAuditLog } from "@/lib/compliance/audit"
import { generateComplianceAlertsForClient } from "@/lib/compliance/generate"
import { logKycAccess, syncAdvancedKycArtifacts } from "@/lib/compliance/kyc-advanced"
import { evaluateKycProfile } from "@/lib/compliance/kyc-engine"
import { syncKycOpportunityPipeline } from "@/lib/compliance/kyc-opportunity"
import { assertCanEditKyc } from "@/lib/compliance/permissions"
import { calculateComplianceScore } from "@/lib/compliance/score"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { assertActivePurposeConsent } from "@/lib/privacy/service"
import { getTenantContext } from "@/lib/tenant"
import { kycProfileSchema, updateKycProfileSchema } from "@/lib/validations/kyc"

type RouteContext = { params: Promise<{ id: string }> }
type KycSyncInput = {
  subjectType?: string | null
  legalFirstName?: string | null
  legalLastName?: string | null
  dateOfBirth?: Date | null
  countryOfResidence?: string | null
  provinceOfResidence?: string | null
  maritalStatus?: string | null
  dependentsCount?: number | null
  occupation?: string | null
  employer?: string | null
  employmentStatus?: string | null
  yearsAtJob?: number | null
  annualIncome?: number | null
  incomeRange?: string | null
  netWorth?: number | null
  liquidNetWorth?: number | null
  totalLiabilities?: number | null
  primaryObjective?: string | null
  investmentHorizon?: string | null
  riskProfileResult?: string | null
  financialGoals?: string | null
  protectionNeeds?: string | null
  nextKycReviewAt?: Date | null
}

async function getClient(id: string, organizationId: string) {
  return prisma.client.findFirst({
    where: { id, organizationId },
    include: { documents: true, consents: true, kycProfile: true },
  })
}

function hasValue(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0
  return value !== null && typeof value !== "undefined"
}

function mapEmploymentStatus(value?: string | null) {
  if (!value) return undefined
  if (value === "BUSINESS_OWNER" || value === "INCORPORATED") return "SELF_EMPLOYED"
  if (["EMPLOYED", "SELF_EMPLOYED", "UNEMPLOYED", "RETIRED", "STUDENT", "OTHER"].includes(value)) return value
  return "OTHER"
}

function mapPrimaryGoal(value?: string | null) {
  if (!value) return undefined
  if (value === "BUSINESS_PROTECTION") return "PROTECTION"
  if (value === "ESTATE_PLANNING") return "OTHER"
  if (["RETIREMENT", "WEALTH_BUILDING", "PROTECTION", "TAX_OPTIMIZATION", "EDUCATION", "OTHER"].includes(value)) return value
  return "OTHER"
}

function mapRiskProfile(value?: string | null) {
  if (!value) return undefined
  if (["CONSERVATIVE", "MODERATE", "BALANCED", "GROWTH", "AGGRESSIVE", "UNKNOWN"].includes(value)) return value
  return "UNKNOWN"
}

function buildClientSyncDataFromKyc(kyc: KycSyncInput): Prisma.ClientUpdateInput {
  const data: Prisma.ClientUpdateInput = {}

  if (hasValue(kyc.subjectType)) data.profileType = kyc.subjectType as ClientProfileType
  if (hasValue(kyc.legalFirstName)) data.firstName = String(kyc.legalFirstName)
  if (hasValue(kyc.legalLastName)) data.lastName = String(kyc.legalLastName)
  if (hasValue(kyc.dateOfBirth)) data.dateOfBirth = kyc.dateOfBirth
  if (hasValue(kyc.countryOfResidence)) data.country = kyc.countryOfResidence
  if (hasValue(kyc.provinceOfResidence)) data.province = kyc.provinceOfResidence
  if (hasValue(kyc.maritalStatus)) data.familyStatus = kyc.maritalStatus
  if (hasValue(kyc.dependentsCount)) {
    data.dependents = kyc.dependentsCount
    data.dependentsCount = kyc.dependentsCount
    data.hasChildren = Number(kyc.dependentsCount) > 0
  }
  if (hasValue(kyc.occupation)) data.occupation = kyc.occupation
  if (hasValue(kyc.employer)) data.employer = kyc.employer
  if (hasValue(kyc.yearsAtJob)) data.yearsAtJob = kyc.yearsAtJob
  if (hasValue(kyc.employmentStatus)) {
    data.employmentStatus = mapEmploymentStatus(kyc.employmentStatus)
    data.isSelfEmployed = kyc.employmentStatus === "SELF_EMPLOYED" || kyc.employmentStatus === "BUSINESS_OWNER" || kyc.employmentStatus === "INCORPORATED"
  }
  if (hasValue(kyc.annualIncome)) {
    data.annualIncome = kyc.annualIncome
    data.approximateIncome = kyc.annualIncome
  }
  if (hasValue(kyc.incomeRange)) data.incomeRange = kyc.incomeRange
  if (hasValue(kyc.netWorth)) data.netWorth = kyc.netWorth
  if (hasValue(kyc.liquidNetWorth)) data.liquidAssets = kyc.liquidNetWorth
  if (hasValue(kyc.totalLiabilities)) data.liabilities = kyc.totalLiabilities
  if (hasValue(kyc.primaryObjective)) {
    data.primaryGoal = mapPrimaryGoal(kyc.primaryObjective)
    data.retirementGoal = kyc.primaryObjective === "RETIREMENT"
  }
  if (hasValue(kyc.investmentHorizon)) data.investmentHorizon = kyc.investmentHorizon
  if (hasValue(kyc.riskProfileResult)) data.riskProfile = mapRiskProfile(kyc.riskProfileResult)
  if (hasValue(kyc.financialGoals)) {
    data.financialGoals = kyc.financialGoals
    data.goals = kyc.financialGoals
  }
  if (hasValue(kyc.protectionNeeds)) data.protectionNeeds = true
  if (hasValue(kyc.nextKycReviewAt)) data.nextReviewDate = kyc.nextKycReviewAt

  return data
}

async function syncClientFromKyc({ id, organizationId, kyc }: { id: string; organizationId: string; kyc: KycSyncInput }) {
  const data = buildClientSyncDataFromKyc(kyc)
  if (Object.keys(data).length === 0) return
  await prisma.client.updateMany({ where: { id, organizationId }, data })
}

function getRawOptionalNumber(payload: unknown, key: string) {
  if (!payload || typeof payload !== "object" || !(key in payload)) return undefined
  const value = (payload as Record<string, unknown>)[key]
  if (value === null || typeof value === "undefined" || value === "") return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function defaultNextReviewDate(value?: Date | null) {
  if (value) return value
  const next = new Date()
  next.setFullYear(next.getFullYear() + 3)
  return next
}

async function assertProfileClientConsents({ organizationId, clientId }: { organizationId: string; clientId: string }) {
  await assertActivePurposeConsent({
    organizationId,
    clientId,
    purposeCode: "client_profile_collection",
    errorCode: "CLIENT_PROFILE_COLLECTION_CONSENT_REQUIRED",
  })
  await assertActivePurposeConsent({
    organizationId,
    clientId,
    purposeCode: "kyc_use",
    errorCode: "KYC_USE_CONSENT_REQUIRED",
  })
}

function normalizeKycPayload<T extends Record<string, unknown>>(payload: T) {
  const evaluation = evaluateKycProfile(payload)
  return {
    ...payload,
    riskProfileResult: payload.advisorOverride ? payload.riskProfileResult : payload.riskProfileResult || evaluation.finalRiskProfile,
    nextKycReviewAt: defaultNextReviewDate(payload.nextKycReviewAt instanceof Date ? payload.nextKycReviewAt : undefined),
    reviewStatus: evaluation.alerts.some((alert) => alert.severity === "CRITICAL" || alert.severity === "HIGH")
      ? "SYSTEM_FLAGS"
      : evaluation.completionScore >= 85
        ? "READY_FOR_ADVISOR_REVIEW"
        : payload.reviewStatus,
  }
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const client = await getClient(id, organizationId)
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    await logKycAccess({
      organizationId,
      clientId: id,
      accessType: "KYC_VIEW",
      purpose: "Consultation du profil client dans la fiche conseiller.",
      sensitiveFields: ["identity", "income", "netWorth", "riskProfile"],
      masked: true,
    })
    return ok({ kyc: client.kycProfile, complianceScore: client.kycProfile?.complianceScore ?? 0 })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    assertCanEditKyc(user)
    const { organizationId } = await getTenantContext()
    const rawPayload = await request.json()
    const payload = normalizeKycPayload(kycProfileSchema.parse(rawPayload))
    const client = await getClient(id, organizationId)
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    await assertProfileClientConsents({ organizationId, clientId: id })

    const score = calculateComplianceScore(payload, client.documents, client.consents)
    const kyc = await prisma.clientKycProfile.create({
      data: {
        ...payload,
        secondaryObjectives: payload.secondaryObjectives as Prisma.InputJsonValue | undefined,
        organizationId,
        clientId: id,
        complianceScore: score,
      },
    })
    await syncClientFromKyc({ id, organizationId, kyc: { ...payload, yearsAtJob: getRawOptionalNumber(rawPayload, "yearsAtJob") } })

    await createCrmActivity({ organizationId, userId: user.id, clientId: id, type: "KYC_CREATED", title: "Profil client créé", description: `Score conformité: ${score}` })
    await createAuditLog({ organizationId, userId: user.id, clientId: id, entityType: "KYC", entityId: kyc.id, action: "KYC_CREATED", newValue: { status: kyc.status, complianceScore: score } })
    await syncAdvancedKycArtifacts({ organizationId, clientId: id, userId: user.id, kyc })
    await syncKycOpportunityPipeline({ organizationId, clientId: id, userId: user.id })
    await generateComplianceAlertsForClient({ organizationId, clientId: id, userId: user.id })
    return ok(kyc, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const user = await getCurrentUserWithOrg()
    if (!user) return fail("UNAUTHORIZED", "Authentification requise.", 401)
    assertCanEditKyc(user)
    const { organizationId } = await getTenantContext()
    const rawPayload = await request.json()
    const payload = normalizeKycPayload(updateKycProfileSchema.parse(rawPayload))
    const client = await getClient(id, organizationId)
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    if (!client.kycProfile) return fail("NOT_FOUND", "Profil client introuvable.", 404)
    await assertProfileClientConsents({ organizationId, clientId: id })

    const merged = { ...client.kycProfile, ...payload }
    const score = calculateComplianceScore(merged, client.documents, client.consents)
    await prisma.clientKycProfile.updateMany({
      where: { id: client.kycProfile.id, organizationId },
      data: {
        ...payload,
        secondaryObjectives: payload.secondaryObjectives as Prisma.InputJsonValue | undefined,
        complianceScore: score,
      },
    })
    const kyc = await prisma.clientKycProfile.findFirstOrThrow({ where: { id: client.kycProfile.id, organizationId } })
    await syncClientFromKyc({ id, organizationId, kyc: { ...merged, yearsAtJob: getRawOptionalNumber(rawPayload, "yearsAtJob") } })

    await createCrmActivity({ organizationId, userId: user.id, clientId: id, type: "KYC_UPDATED", title: "Profil client modifié", description: `Score conformité: ${score}` })
    await createAuditLog({ organizationId, userId: user.id, clientId: id, entityType: "KYC", entityId: kyc.id, action: "KYC_UPDATED", newValue: { status: kyc.status, complianceScore: score } })
    await syncAdvancedKycArtifacts({ organizationId, clientId: id, userId: user.id, kyc })
    await syncKycOpportunityPipeline({ organizationId, clientId: id, userId: user.id })
    await generateComplianceAlertsForClient({ organizationId, clientId: id, userId: user.id })
    return ok(kyc)
  } catch (error) {
    return handleApiError(error)
  }
}
