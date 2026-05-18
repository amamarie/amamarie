import { type ClientProfileType, Prisma } from "@prisma/client"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { getCurrentUserWithOrg } from "@/lib/auth"
import { createAuditLog } from "@/lib/compliance/audit"
import { generateComplianceAlertsForClient } from "@/lib/compliance/generate"
import { assertCanEditKyc } from "@/lib/compliance/permissions"
import { createCrmActivity } from "@/lib/crm-events"
import { prisma } from "@/lib/prisma"
import { getTenantContext } from "@/lib/tenant"
import { kybProfileSchema, updateKybProfileSchema } from "@/lib/validations/kyb"

type RouteContext = { params: Promise<{ id: string }> }

type KybScoreInput = {
  legalName?: string | null
  entityType?: string | null
  jurisdiction?: string | null
  registrationNumber?: string | null
  businessActivity?: string | null
  directorsDocumented?: boolean | null
  shareholdersDocumented?: boolean | null
  beneficialOwnersDocumented?: boolean | null
  authorizedSignersDocumented?: boolean | null
  corporateDocumentsCollected?: boolean | null
  sourceOfFunds?: string | null
  sourceOfWealth?: string | null
  amlRiskLevel?: string | null
}

async function getClient(id: string, organizationId: string) {
  return prisma.client.findFirst({
    where: { id, organizationId },
    include: { kybProfile: true },
  })
}

function hasValue(value: unknown) {
  if (typeof value === "string") return value.trim().length > 0
  return value !== null && typeof value !== "undefined" && value !== false
}

function calculateKybScore(data: KybScoreInput) {
  const checks = [
    data.legalName,
    data.entityType,
    data.jurisdiction,
    data.registrationNumber,
    data.businessActivity,
    data.directorsDocumented,
    data.shareholdersDocumented,
    data.beneficialOwnersDocumented,
    data.authorizedSignersDocumented,
    data.corporateDocumentsCollected,
    data.sourceOfFunds,
    data.sourceOfWealth,
    data.amlRiskLevel,
  ]
  return Math.round((checks.filter(hasValue).length / checks.length) * 100)
}

function buildClientSyncDataFromKyb(payload: { subjectType?: string | null; legalName?: string | null; businessActivity?: string | null }) {
  const data: Prisma.ClientUpdateInput = {}
  if (payload.subjectType) data.profileType = payload.subjectType as ClientProfileType
  if (payload.legalName) data.employer = payload.legalName
  if (payload.businessActivity) data.occupation = payload.businessActivity
  return data
}

async function syncClientFromKyb({
  id,
  organizationId,
  payload,
}: {
  id: string
  organizationId: string
  payload: { subjectType?: string | null; legalName?: string | null; businessActivity?: string | null }
}) {
  const data = buildClientSyncDataFromKyb(payload)
  if (Object.keys(data).length === 0) return
  await prisma.client.updateMany({ where: { id, organizationId }, data })
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const client = await getClient(id, organizationId)
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    return ok({ kyb: client.kybProfile, kybScore: client.kybProfile?.kybScore ?? 0 })
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
    const payload = kybProfileSchema.parse(rawPayload)
    const client = await getClient(id, organizationId)
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)

    const kybScore = calculateKybScore(payload)
    const kyb = await prisma.clientKybProfile.create({
      data: {
        ...payload,
        organizationId,
        clientId: id,
        kybScore,
      },
    })

    await syncClientFromKyb({ id, organizationId, payload })
    await createCrmActivity({
      organizationId,
      userId: user.id,
      clientId: id,
      type: "CLIENT_UPDATED",
      title: "KYB créé",
      description: `Score KYB: ${kybScore}`,
    })
    await createAuditLog({
      organizationId,
      userId: user.id,
      clientId: id,
      entityType: "KYB",
      entityId: kyb.id,
      action: "KYB_CREATED",
      newValue: { status: kyb.status, kybScore },
    })
    await generateComplianceAlertsForClient({ organizationId, clientId: id, userId: user.id })
    return ok(kyb, { status: 201 })
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
    const payload = updateKybProfileSchema.parse(rawPayload)
    const client = await getClient(id, organizationId)
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    if (!client.kybProfile) return fail("NOT_FOUND", "Profil KYB introuvable.", 404)

    const merged = { ...client.kybProfile, ...payload }
    const kybScore = calculateKybScore(merged)
    await prisma.clientKybProfile.updateMany({
      where: { id: client.kybProfile.id, organizationId },
      data: {
        ...payload,
        kybScore,
      },
    })
    const kyb = await prisma.clientKybProfile.findFirstOrThrow({ where: { id: client.kybProfile.id, organizationId } })

    await syncClientFromKyb({ id, organizationId, payload: merged })
    await createCrmActivity({
      organizationId,
      userId: user.id,
      clientId: id,
      type: "CLIENT_UPDATED",
      title: "KYB modifié",
      description: `Score KYB: ${kybScore}`,
    })
    await createAuditLog({
      organizationId,
      userId: user.id,
      clientId: id,
      entityType: "KYB",
      entityId: kyb.id,
      action: "KYB_UPDATED",
      newValue: { status: kyb.status, kybScore },
    })
    await generateComplianceAlertsForClient({ organizationId, clientId: id, userId: user.id })
    return ok(kyb)
  } catch (error) {
    return handleApiError(error)
  }
}
