import { Prisma } from "@prisma/client"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { createCrmActivity } from "@/lib/crm-events"
import { createAuditLog } from "@/lib/compliance/audit"
import { generateComplianceAlertsForClient } from "@/lib/compliance/generate"
import { prisma } from "@/lib/prisma"
import { sendConsentRequestToClient } from "@/lib/privacy/notifications"
import { createConsentEvent } from "@/lib/privacy/service"
import { getTenantContext } from "@/lib/tenant"
import { createConsentSchema } from "@/lib/validations/consent"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId } = await getTenantContext()
    const client = await prisma.client.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    return ok(await prisma.clientConsent.findMany({ where: { organizationId, clientId: id }, include: { purpose: true, template: true, events: { orderBy: { createdAt: "desc" }, take: 5 } }, orderBy: { createdAt: "desc" } }))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params
    const { organizationId, userId } = await getTenantContext()
    const payload = createConsentSchema.parse(await request.json())
    const client = await prisma.client.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!client) return fail("NOT_FOUND", "Client introuvable.", 404)
    const dataCategories = payload.dataCategories === undefined ? undefined : payload.dataCategories === null ? Prisma.JsonNull : payload.dataCategories as Prisma.InputJsonValue
    const thirdParties = payload.thirdParties === undefined ? undefined : payload.thirdParties === null ? Prisma.JsonNull : payload.thirdParties as Prisma.InputJsonValue
    const consent = await prisma.clientConsent.create({
      data: {
        organizationId,
        clientId: id,
        capturedById: userId,
        type: payload.type,
        purposeId: payload.purposeId,
        templateId: payload.templateId,
        status: payload.status,
        consentText: payload.consentText,
        version: payload.version,
        language: payload.language,
        method: payload.method,
        purposeText: payload.purposeText,
        dataCategories,
        thirdParties,
        isSensitive: payload.isSensitive,
        isRequiredForService: payload.isRequiredForService,
        withdrawalAllowed: payload.withdrawalAllowed,
        proofDocumentId: payload.proofDocumentId,
        relatedEntityType: payload.relatedEntityType,
        relatedEntityId: payload.relatedEntityId,
        givenAt: payload.status === "GIVEN" ? payload.givenAt ?? new Date() : payload.givenAt,
        revokedAt: payload.revokedAt,
        expiresAt: payload.expiresAt,
        notes: payload.notes,
      },
    })
    await createConsentEvent({
      organizationId,
      consentId: consent.id,
      eventType: consent.status === "GIVEN" ? "ACCEPTED" : consent.status === "DECLINED" ? "DECLINED" : "CREATED",
      actorType: "ADVISOR",
      actorId: userId,
      metadata: { method: consent.method, type: consent.type },
    })
    if (consent.status === "GIVEN") {
      await createCrmActivity({ organizationId, userId, clientId: id, type: "CONSENT_GIVEN", title: "Consentement donné", description: consent.type })
    }
    if (consent.status === "REQUESTED") {
      await sendConsentRequestToClient({ organizationId, userId, consent })
    }
    await createAuditLog({ organizationId, userId, clientId: id, entityType: "CONSENT", entityId: consent.id, action: consent.status === "GIVEN" ? "CONSENT_GIVEN" : "CONSENT_CREATED", newValue: { type: consent.type, status: consent.status } })
    await generateComplianceAlertsForClient({ organizationId, clientId: id, userId })
    return ok(consent, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
