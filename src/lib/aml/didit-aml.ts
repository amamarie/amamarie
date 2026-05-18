import type { Prisma } from "@prisma/client"

import { ensureAmlProfile, recalculateAmlRisk } from "@/lib/aml/service"
import { createAuditLog } from "@/lib/compliance/audit"
import { prisma } from "@/lib/prisma"

type DiditHit = {
  caption?: string
  datasets?: string[]
  match_score?: number
  risk_score?: number
  review_status?: string
  sanction_matches?: Array<Record<string, unknown>>
  pep_matches?: Array<Record<string, unknown>>
  adverse_media_matches?: Array<Record<string, unknown>>
  warning_matches?: Array<Record<string, unknown>>
  properties?: {
    nationality?: string[]
    country?: string[]
    birthDate?: string[]
    position?: string[]
  }
}

type DiditAmlResponse = {
  request_id?: string
  aml?: {
    status?: string
    total_hits?: number
    entity_type?: string
    hits?: DiditHit[]
  }
}

function diditConfig() {
  return {
    apiKey: process.env.IDV_PROVIDER_API_KEY,
    baseUrl: process.env.IDV_PROVIDER_BASE_URL ?? "https://verification.didit.me",
    amlPath: process.env.DIDIT_AML_SCREENING_PATH ?? "/v3/aml/",
  }
}

export function getDiditAmlStatus() {
  const config = diditConfig()
  const missing: string[] = []
  if (!config.apiKey) missing.push("IDV_PROVIDER_API_KEY")
  if (!config.baseUrl) missing.push("IDV_PROVIDER_BASE_URL")
  return {
    configured: missing.length === 0,
    baseUrl: config.baseUrl,
    amlPath: config.amlPath,
    missing,
  }
}

function diditUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString()
}

function countryCode(value?: string | null) {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) return undefined
  if (["canada", "ca", "can"].includes(normalized)) return "CA"
  if (["united states", "usa", "us", "états-unis", "etats-unis"].includes(normalized)) return "US"
  return value?.length === 2 ? value.toUpperCase() : value
}

function firstString(value: unknown) {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : undefined
}

function hitDatasets(hit: DiditHit) {
  return (hit.datasets ?? []).map((dataset) => dataset.toUpperCase())
}

function isSanctionsHit(hit: DiditHit) {
  const datasets = hitDatasets(hit)
  return (hit.sanction_matches?.length ?? 0) > 0
    || datasets.some((dataset) => dataset.includes("SANCTION") || dataset.includes("TERROR"))
}

function isPepHit(hit: DiditHit) {
  const datasets = hitDatasets(hit)
  return (hit.pep_matches?.length ?? 0) > 0 || datasets.includes("PEP")
}

function strongestHit(hits: DiditHit[]) {
  return [...hits].sort((a, b) => Number(b.match_score ?? b.risk_score ?? 0) - Number(a.match_score ?? a.risk_score ?? 0))[0]
}

function hitScore(hit?: DiditHit) {
  const score = Number(hit?.match_score ?? hit?.risk_score ?? 0)
  return Number.isFinite(score) ? score : undefined
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue
}

export async function runDiditAmlScreening({
  organizationId,
  clientId,
  userId,
  request,
  includeAdverseMedia = false,
  includeOngoingMonitoring = false,
}: {
  organizationId: string
  clientId: string
  userId?: string | null
  request?: Request
  includeAdverseMedia?: boolean
  includeOngoingMonitoring?: boolean
}) {
  const config = diditConfig()
  const status = getDiditAmlStatus()
  if (!status.configured) return { providerConfigured: false, missing: status.missing }

  const profile = await ensureAmlProfile({ organizationId, clientId, userId, request })
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      country: true,
      profileType: true,
    },
  })
  if (!client) throw new Error("CLIENT_NOT_FOUND")

  const fullName = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim()
  const response = await fetch(diditUrl(config.baseUrl, config.amlPath), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey ?? "",
    },
    body: JSON.stringify({
      full_name: fullName,
      entity_type: client.profileType === "BUSINESS" ? "company" : "person",
      date_of_birth: client.dateOfBirth?.toISOString().slice(0, 10),
      nationality: countryCode(client.country),
      aml_score_approve_threshold: 80,
      aml_score_review_threshold: 100,
      aml_match_score_threshold: 93,
      include_adverse_media: includeAdverseMedia,
      include_ongoing_monitoring: includeOngoingMonitoring,
      save_api_request: true,
      vendor_data: clientId,
    }),
  })

  const providerResponse = await response.json().catch(() => ({ statusText: response.statusText })) as DiditAmlResponse
  const hits = providerResponse.aml?.hits ?? []
  const sanctionsHits = hits.filter(isSanctionsHit)
  const pepHits = hits.filter(isPepHit)
  const adverseHits = hits.filter((hit) => (hit.adverse_media_matches?.length ?? 0) > 0)
  const sanctionsHit = strongestHit(sanctionsHits)
  const pepHit = strongestHit(pepHits)
  const hasSanctions = sanctionsHits.length > 0
  const hasPep = pepHits.length > 0

  const sanctionsRecord = await prisma.amlSanctionsScreening.create({
    data: {
      organizationId,
      clientId,
      amlProfileId: profile.id,
      screenedEntityType: client.profileType === "BUSINESS" ? "BUSINESS" : "CLIENT",
      screenedEntityId: client.id,
      nameScreened: fullName,
      aliasesScreened: sanctionsHit?.properties?.nationality ?? undefined,
      listsUsed: ["DIDIT_AML", "SANCTIONS", "WATCHLISTS"],
      provider: "DIDIT",
      result: hasSanctions ? "POTENTIAL_MATCH" : "NO_MATCH",
      matchScore: hitScore(sanctionsHit),
      matchedName: sanctionsHit?.caption ?? null,
      matchedList: sanctionsHit?.datasets?.join(", ") ?? null,
      matchType: hasSanctions ? "DIDIT_AML_SANCTIONS" : null,
      decision: hasSanctions ? "PENDING" : "CLEARED",
      decisionReason: hasSanctions ? null : "Aucun match sanctions retourné par Didit AML Screening.",
      decidedById: hasSanctions ? null : userId,
      decidedAt: hasSanctions ? null : new Date(),
      nextReviewAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      metadata: safeJson({
        providerRequestId: providerResponse.request_id,
        diditStatus: providerResponse.aml?.status,
        diditTotalHits: providerResponse.aml?.total_hits,
        sanctionsHits,
      }),
    },
  })

  const pepRecord = await prisma.amlPepScreening.create({
    data: {
      organizationId,
      clientId,
      amlProfileId: profile.id,
      screenedPersonName: fullName,
      screeningType: client.profileType === "BUSINESS" ? "BUSINESS_RELATED_PERSON" : "CLIENT",
      result: hasPep ? "POSITIVE" : "NO_MATCH",
      pepType: hasPep ? "PEP" : null,
      positionTitle: firstString(pepHit?.properties?.position) ?? null,
      organizationName: pepHit?.caption ?? null,
      country: firstString(pepHit?.properties?.country) ?? countryCode(client.country) ?? null,
      sourceOfFundsRequired: hasPep,
      sourceOfWealthRequired: hasPep,
      seniorManagementReviewRequired: hasPep,
      reviewedById: hasPep ? null : userId,
      reviewedAt: hasPep ? null : new Date(),
      notes: hasPep ? "Match PPV/PEP retourné par Didit AML Screening." : "Aucun match PPV/PEP retourné par Didit AML Screening.",
      metadata: safeJson({
        providerRequestId: providerResponse.request_id,
        diditStatus: providerResponse.aml?.status,
        diditTotalHits: providerResponse.aml?.total_hits,
        pepHits,
        adverseHits,
      }),
    },
  })

  if (adverseHits.length > 0) {
    await prisma.amlMonitoringEvent.create({
      data: {
        organizationId,
        clientId,
        amlProfileId: profile.id,
        eventType: "ADVERSE_MEDIA",
        eventTitle: "Médias défavorables détectés par Didit AML Screening",
        description: `${adverseHits.length} résultat(s) adverse media à revoir.`,
        riskImpact: 4,
        sourceEntityType: "DIDIT_AML_SCREENING",
        status: "OPEN",
        metadata: safeJson({ providerRequestId: providerResponse.request_id, adverseHits }),
      },
    })
  }

  await createAuditLog({
    organizationId,
    userId,
    clientId,
    entityType: "AmlProfile",
    entityId: profile.id,
    action: "AML_DIDIT_SCREENING_COMPLETED",
    source: "system",
    sensitivityLevel: "HIGH",
    newValue: {
      providerStatus: response.status,
      requestId: providerResponse.request_id,
      totalHits: providerResponse.aml?.total_hits,
      sanctionsResult: sanctionsRecord.result,
      pepResult: pepRecord.result,
    },
    request,
  })

  const updatedProfile = await recalculateAmlRisk({ organizationId, clientId, userId, request })
  return {
    providerConfigured: true,
    providerStatus: response.status,
    providerResponse,
    sanctionsRecord,
    pepRecord,
    profile: updatedProfile,
  }
}
